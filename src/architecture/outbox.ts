import { randomUUID } from "node:crypto";

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

export interface Outbox {
  append<T>(event: Omit<DurableEvent<T>, "eventId" | "createdAt" | "attempts" | "lastError" | "nextAttemptAt">): Promise<DurableEvent<T>>;
  listPending(limit?: number): Promise<readonly DurableEvent[]>;
  markPublished(eventId: string): Promise<void>;
  markFailed(eventId: string, error: unknown, nextAttemptAt: string): Promise<void>;
}

export interface Inbox {
  claimEvent(consumerId: string, eventId: string): Promise<boolean>;
  complete(consumerId: string, eventId: string): Promise<void>;
  release(consumerId: string, eventId: string): Promise<void>;
}

export class InMemoryOutbox implements Outbox {
  private readonly pending = new Map<string, DurableEvent>();

  async append<T>(
    event: Omit<DurableEvent<T>, "eventId" | "createdAt" | "attempts" | "lastError" | "nextAttemptAt">,
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
      .filter((event) => event.nextAttemptAt === undefined || Date.parse(event.nextAttemptAt) <= now)
      .slice(0, Math.max(1, Math.floor(limit)));
  }

  async markPublished(eventId: string): Promise<void> {
    if (!this.pending.delete(eventId)) {
      throw new Error("Outbox event was already published or does not exist.");
    }
  }

  async markFailed(eventId: string, error: unknown, nextAttemptAt: string): Promise<void> {
    const current = this.pending.get(eventId);
    if (!current) throw new Error("Outbox event does not exist.");
    this.pending.set(eventId, {
      ...current,
      attempts: (current.attempts ?? 0) + 1,
      lastError: error,
      nextAttemptAt,
    });
  }
}

export class InMemoryInbox implements Inbox {
  private readonly claims = new Set<string>();

  async claimEvent(consumerId: string, eventId: string): Promise<boolean> {
    const key = consumerId + ":" + eventId;
    if (this.claims.has(key)) return false;
    this.claims.add(key);
    return true;
  }

  async complete(_consumerId: string, _eventId: string): Promise<void> {}
  
  async release(consumerId: string, eventId: string): Promise<void> {
    this.claims.delete(consumerId + ":" + eventId);
  }
}

export async function consumeAtLeastOncePerConsumer<T>(
  inbox: Inbox,
  consumerId: string,
  event: DurableEvent<T>,
  handler: (event: DurableEvent<T>) => Promise<void>,
): Promise<boolean> {
  if (!(await inbox.claimEvent(consumerId, event.eventId))) return false;

  try {
    await handler(event);
    await inbox.complete(consumerId, event.eventId);
    return true;
  } catch (error) {
    await inbox.release(consumerId, event.eventId);
    throw error;
  }
}
