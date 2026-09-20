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
  seen(consumerId: string, eventId: string): Promise<boolean>;
  record(consumerId: string, eventId: string): Promise<void>;
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
  private readonly processed = new Set<string>();

  async seen(consumerId: string, eventId: string): Promise<boolean> {
    return this.processed.has(consumerId + ":" + eventId);
  }

  async record(consumerId: string, eventId: string): Promise<void> {
    this.processed.add(consumerId + ":" + eventId);
  }
}

export async function consumeExactlyOncePerConsumer<T>(
  inbox: Inbox,
  consumerId: string,
  event: DurableEvent<T>,
  handler: (event: DurableEvent<T>) => Promise<void>,
): Promise<boolean> {
  if (await inbox.seen(consumerId, event.eventId)) return false;
  await handler(event);
  await inbox.record(consumerId, event.eventId);
  return true;
}
