import { randomUUID } from "node:crypto";

export const DEFAULT_CLAIM_STALE_AFTER_MS = 5 * 60_000;
export const DEFAULT_OUTBOX_CLAIM_TTL_MS = 30_000;

export interface DurableEvent<T = unknown> {
  readonly eventId: string;
  readonly type: string;
  readonly version: number;
  readonly createdAt: string;
  readonly aggregateId: string;
  readonly runId?: string;
  readonly workspaceId?: string;
  readonly projectId?: string;
  readonly threadId?: string;
  readonly actorId?: string;
  readonly parentEventId?: string;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly durable?: boolean;
  readonly attempts?: number;
  readonly lastError?: unknown;
  readonly nextAttemptAt?: string;
  readonly payload: T;
}

export interface OutboxClaim {
  readonly event: DurableEvent;
  readonly claimId: string;
  readonly ownerId: string;
  readonly claimedUntil: string;
}

export interface Outbox {
  append<T>(
    event: Omit<
      DurableEvent<T>,
      "eventId" | "createdAt" | "attempts" | "lastError" | "nextAttemptAt"
    >,
  ): Promise<DurableEvent<T>>;
  listPending(limit?: number): Promise<readonly DurableEvent[]>;
  claimPending(
    ownerId: string,
    limit?: number,
    ttlMs?: number,
    nowMs?: number,
  ): Promise<readonly OutboxClaim[]>;
  markPublished(eventId: string, claimId?: string): Promise<void>;
  markFailed(eventId: string, error: unknown, nextAttemptAt: string): Promise<void>;
  releaseClaim(eventId: string, claimId: string): Promise<void>;
}

export interface Inbox {
  claimEvent(
    consumerId: string,
    eventId: string,
    staleAfterMs?: number,
    nowMs?: number,
  ): Promise<boolean>;
  complete(consumerId: string, eventId: string): Promise<void>;
  release(consumerId: string, eventId: string): Promise<void>;
}

export class InMemoryOutbox implements Outbox {
  private readonly pending = new Map<string, DurableEvent>();
  private readonly claims = new Map<
    string,
    { claimId: string; ownerId: string; claimedUntil: number }
  >();

  async append<T>(
    event: Omit<
      DurableEvent<T>,
      "eventId" | "createdAt" | "attempts" | "lastError" | "nextAttemptAt"
    >,
  ): Promise<DurableEvent<T>> {
    const durableEvent: DurableEvent<T> = {
      ...event,
      eventId: randomUUID(),
      createdAt: new Date().toISOString(),
      attempts: 0,
      durable: true,
    };
    this.pending.set(durableEvent.eventId, durableEvent);
    return durableEvent;
  }

  async listPending(limit = 100): Promise<readonly DurableEvent[]> {
    const now = Date.now();
    return [...this.pending.values()]
      .filter(
        (event) =>
          event.nextAttemptAt === undefined ||
          Date.parse(event.nextAttemptAt) <= now,
      )
      .slice(0, normalizeLimit(limit));
  }

  async claimPending(
    ownerId: string,
    limit = 100,
    ttlMs = DEFAULT_OUTBOX_CLAIM_TTL_MS,
    nowMs = Date.now(),
  ): Promise<readonly OutboxClaim[]> {
    assertOutboxClaimWindow(ownerId, limit, ttlMs, nowMs);
    const claims: OutboxClaim[] = [];

    for (const event of this.pending.values()) {
      if (claims.length >= normalizeLimit(limit)) break;
      const current = this.claims.get(event.eventId);
      if (current && current.claimedUntil > nowMs) continue;

      const claim = {
        claimId: randomUUID(),
        ownerId,
        claimedUntil: nowMs + ttlMs,
      };
      this.claims.set(event.eventId, claim);
      claims.push({
        event,
        claimId: claim.claimId,
        ownerId,
        claimedUntil: new Date(claim.claimedUntil).toISOString(),
      });
    }

    return claims;
  }

  async markPublished(eventId: string, claimId?: string): Promise<void> {
    const current = this.claims.get(eventId);
    if (claimId !== undefined && (!current || current.claimId !== claimId)) {
      throw new Error("Outbox publication fencing rejected: " + eventId);
    }
    if (!this.pending.delete(eventId)) {
      throw new Error("Outbox event was already published or does not exist.");
    }
    this.claims.delete(eventId);
  }

  async markFailed(
    eventId: string,
    error: unknown,
    nextAttemptAt: string,
  ): Promise<void> {
    const current = this.pending.get(eventId);
    if (!current) throw new Error("Outbox event does not exist.");
    this.pending.set(eventId, {
      ...current,
      attempts: (current.attempts ?? 0) + 1,
      lastError: error,
      nextAttemptAt,
    });
  }

  async releaseClaim(eventId: string, claimId: string): Promise<void> {
    const current = this.claims.get(eventId);
    if (!current || current.claimId !== claimId) return;
    this.claims.delete(eventId);
  }
}

export class InMemoryInbox implements Inbox {
  private readonly claims = new Map<string, number>();
  private readonly completed = new Set<string>();

  async claimEvent(
    consumerId: string,
    eventId: string,
    staleAfterMs = DEFAULT_CLAIM_STALE_AFTER_MS,
    nowMs = Date.now(),
  ): Promise<boolean> {
    assertClaimWindow(staleAfterMs, nowMs);
    const key = consumerId + ":" + eventId;
    if (this.completed.has(key)) return false;

    const claimedAt = this.claims.get(key);
    if (claimedAt !== undefined && nowMs - claimedAt < staleAfterMs) {
      return false;
    }

    this.claims.set(key, nowMs);
    return true;
  }

  async complete(consumerId: string, eventId: string): Promise<void> {
    const key = consumerId + ":" + eventId;
    if (!this.claims.has(key)) {
      throw new Error("Inbox claim is missing: " + key);
    }
    this.claims.delete(key);
    this.completed.add(key);
  }

  async release(consumerId: string, eventId: string): Promise<void> {
    this.claims.delete(consumerId + ":" + eventId);
  }
}

export async function consumeAtLeastOncePerConsumer<T>(
  inbox: Inbox,
  consumerId: string,
  event: DurableEvent<T>,
  handler: (event: DurableEvent<T>) => Promise<void>,
  staleAfterMs = DEFAULT_CLAIM_STALE_AFTER_MS,
  nowMs = Date.now(),
): Promise<boolean> {
  if (
    !(await inbox.claimEvent(
      consumerId,
      event.eventId,
      staleAfterMs,
      nowMs,
    ))
  ) {
    return false;
  }

  try {
    await handler(event);
    await inbox.complete(consumerId, event.eventId);
    return true;
  } catch (error) {
    await inbox.release(consumerId, event.eventId);
    throw error;
  }
}

function assertOutboxClaimWindow(
  ownerId: string,
  limit: number,
  ttlMs: number,
  nowMs: number,
): void {
  if (!ownerId.trim()) throw new Error("Outbox ownerId cannot be empty.");
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("Outbox limit must be positive.");
  }
  if (!Number.isInteger(ttlMs) || ttlMs <= 0) {
    throw new Error("Outbox claim ttlMs must be positive.");
  }
  if (!Number.isFinite(nowMs) || nowMs < 0) {
    throw new Error("Outbox claim clock is invalid.");
  }
}

function assertClaimWindow(staleAfterMs: number, nowMs: number): void {
  if (!Number.isInteger(staleAfterMs) || staleAfterMs <= 0) {
    throw new Error("Claim staleAfterMs must be a positive integer.");
  }
  if (!Number.isFinite(nowMs) || nowMs < 0) {
    throw new Error("Claim clock value is invalid.");
  }
}

function normalizeLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) return 1;
  return Math.floor(limit);
}
