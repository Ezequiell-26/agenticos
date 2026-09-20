import { randomUUID } from "node:crypto";

export const DEFAULT_CLAIM_STALE_AFTER_MS = 5 * 60_000;

export interface DurableEvent<T = unknown> {
  readonly eventId: string;
  readonly type: string;
  readonly version: number;
  readonly createdAt: string;
  readonly aggregateId: string;
  readonly payload: T;
}

export interface Outbox {
  append<T>(
    event: Omit<DurableEvent<T>, "eventId" | "createdAt">,
  ): Promise<DurableEvent<T>>;
  listPending(limit?: number): Promise<readonly DurableEvent[]>;
  markPublished(eventId: string): Promise<void>;
}

export interface Inbox {
  claim(
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

  async append<T>(
    event: Omit<DurableEvent<T>, "eventId" | "createdAt">,
  ): Promise<DurableEvent<T>> {
    const durableEvent: DurableEvent<T> = {
      ...event,
      eventId: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.pending.set(durableEvent.eventId, durableEvent);
    return durableEvent;
  }

  async listPending(limit = 100): Promise<readonly DurableEvent[]> {
    const safeLimit = normalizeLimit(limit);
    return [...this.pending.values()].slice(0, safeLimit);
  }

  async markPublished(eventId: string): Promise<void> {
    if (!this.pending.delete(eventId)) {
      throw new Error("Outbox event is missing or already published: " + eventId);
    }
  }
}

export class InMemoryInbox implements Inbox {
  private readonly claims = new Map<string, number>();
  private readonly completed = new Set<string>();

  async claim(
    consumerId: string,
    eventId: string,
    staleAfterMs = DEFAULT_CLAIM_STALE_AFTER_MS,
    nowMs = Date.now(),
  ): Promise<boolean> {
    assertClaimWindow(staleAfterMs, nowMs);
    const key = consumerId + ":" + eventId;
    if (this.completed.has(key)) return false;

    const claimedAt = this.claims.get(key);
    if (
      claimedAt !== undefined &&
      nowMs - claimedAt < staleAfterMs
    ) {
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
    !(await inbox.claim(
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
