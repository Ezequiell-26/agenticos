import { asAgentiCOSError } from "../architecture/errors.js";
import { computeBackoff, type RetryPolicy } from "../architecture/retry.js";
import type { DurableEvent } from "../architecture/outbox.js";
import type { KernelStore } from "./ports.js";

export interface OutboxDispatchResult {
  readonly published: number;
  readonly failed: boolean;
  readonly deferred: number;
}

export interface OutboxDispatcherOptions {
  readonly retryPolicy?: RetryPolicy;
}

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: Number.MAX_SAFE_INTEGER,
  baseDelayMs: 1_000,
  maxDelayMs: 60_000,
  jitterRatio: 0.2,
};

export class DurableOutboxDispatcher {
  constructor(
    private readonly store: KernelStore,
    private readonly options: OutboxDispatcherOptions = {},
  ) {}

  async dispatch(
    publish: (event: DurableEvent) => Promise<void> | void,
    limit = 100,
  ): Promise<OutboxDispatchResult> {
    if (limit <= 0) return { published: 0, failed: false, deferred: 0 };

    const events = await this.store.listPending(limit);
    let published = 0;

    for (const event of events) {
      try {
        await publish(event);
        await this.store.markPublished(event.eventId);
        published += 1;
      } catch (error) {
        const normalized = asAgentiCOSError(error);
        const policy = this.options.retryPolicy ?? DEFAULT_RETRY_POLICY;
        const attempts = (event.attempts ?? 0) + 1;
        const retryDelay = computeBackoff(policy, attempts, normalized.retryAfterMs);
        const nextAttemptAt = new Date(Date.now() + retryDelay).toISOString();

        await this.store.markFailed(event.eventId, normalized, nextAttemptAt);

        return {
          published,
          failed: true,
          deferred: events.length - published - 1,
        };
      }
    }

    return { published, failed: false, deferred: 0 };
  }
}
