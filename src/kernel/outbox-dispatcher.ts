import type { DurableEvent } from "../architecture/outbox.js";
import type { KernelStore } from "./ports.js";

export interface OutboxDispatchResult {
  readonly published: number;
  readonly failed: boolean;
}

export class DurableOutboxDispatcher {
  constructor(private readonly store: KernelStore) {}

  async dispatch(
    publish: (event: DurableEvent) => Promise<void> | void,
    limit = 100,
  ): Promise<OutboxDispatchResult> {
    if (limit <= 0) return { published: 0, failed: false };

    const events = await this.store.listPending(limit);
    let published = 0;

    for (const event of events) {
      try {
        await publish(event);
        await this.store.markPublished(event.eventId);
        published += 1;
      } catch {
        return { published, failed: true };
      }
    }

    return { published, failed: false };
  }
}
