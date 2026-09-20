import { randomUUID } from "node:crypto";

export interface DurableEvent<T = unknown> {
  readonly eventId: string;
  readonly type: string;
  readonly version: number;
  readonly createdAt: string;
  readonly aggregateId: string;
  readonly payload: T;
}

export interface Outbox {
  append<T>(event: Omit<DurableEvent<T>, "eventId" | "createdAt">): Promise<DurableEvent<T>>;
  listPending(limit?: number): Promise<readonly DurableEvent[]>;
  markPublished(eventId: string): Promise<void>;
}

export interface Inbox {
  claim(consumerId: string, eventId: string): Promise<boolean>;
  complete(consumerId: string, eventId: string): Promise<void>;
  release(consumerId: string, eventId: string): Promise<void>;
}

export class InMemoryOutbox implements Outbox {
  private readonly pending = new Map<string, DurableEvent>();

  async append<T>(event: Omit<DurableEvent<T>, "eventId" | "createdAt">): Promise<DurableEvent<T>> {
    const durableEvent: DurableEvent<T> = {
      ...event,
      eventId: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.pending.set(durableEvent.eventId, durableEvent);
    return durableEvent;
  }

  async listPending(limit = 100): Promise<readonly DurableEvent[]> {
    return [...this.pending.values()].slice(0, limit);
  }

  async markPublished(eventId: string): Promise<void> {
    this.pending.delete(eventId);
  }
}

export class InMemoryInbox implements Inbox {
  private readonly claims = new Set<string>();

  async claim(consumerId: string, eventId: string): Promise<boolean> {
    const key = consumerId + ":" + eventId;
    if (this.claims.has(key)) return false;
    this.claims.add(key);
    return true;
  }

  async complete(_consumerId: string, _eventId: string): Promise<void> {
    // The claim is the deduplication record. Completion is explicit for production adapters.
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
): Promise<boolean> {
  if (!(await inbox.claim(consumerId, event.eventId))) return false;

  try {
    await handler(event);
    await inbox.complete(consumerId, event.eventId);
    return true;
  } catch (error) {
    await inbox.release(consumerId, event.eventId);
    throw error;
  }
}
