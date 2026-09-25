import { randomUUID } from "node:crypto";
import { asAgentiCOSError } from "../architecture/errors.js";
import {
  DEFAULT_OUTBOX_CLAIM_TTL_MS,
  type DurableEvent,
} from "../architecture/outbox.js";
import { computeBackoff, type RetryPolicy } from "../architecture/retry.js";
import type { KernelStore } from "./ports.js";

export interface OutboxDispatchResult {
  readonly published: number;
  readonly failed: boolean;
  readonly deferred: number;
}

export interface OutboxDispatcherOptions {
  readonly retryPolicy?: RetryPolicy;
  readonly workerId?: string;
  readonly claimTtlMs?: number;
}

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: Number.MAX_SAFE_INTEGER,
  baseDelayMs: 1_000,
  maxDelayMs: 60_000,
  jitterRatio: 0.2,
};

export class DurableOutboxDispatcher {
  private readonly workerId: string;
  private readonly claimTtlMs: number;

  constructor(
    private readonly store: KernelStore,
    private readonly options: OutboxDispatcherOptions = {},
  ) {
    this.workerId = options.workerId?.trim() || "outbox-" + randomUUID();
    this.claimTtlMs = options.claimTtlMs ?? DEFAULT_OUTBOX_CLAIM_TTL_MS;

    if (!Number.isInteger(this.claimTtlMs) || this.claimTtlMs <= 0) {
      throw new Error("Outbox dispatcher claimTtlMs must be a positive integer.");
    }
  }

  async dispatch(
    publish: (event: DurableEvent) => Promise<void> | void,
    limit = 100,
    nowMs = Date.now(),
  ): Promise<OutboxDispatchResult> {
    if (!Number.isInteger(limit) || limit <= 0) {
      return { published: 0, failed: false, deferred: 0 };
    }

    const claims = await this.store.claimPending(
      this.workerId,
      limit,
      this.claimTtlMs,
      nowMs,
    );

    let published = 0;

    for (const claim of claims) {
      try {
        await publish(claim.event);
        await this.store.markPublished(claim.event.eventId, claim.claimId);
        published += 1;
      } catch (error) {
        await this.store.releaseClaim(claim.event.eventId, claim.claimId);
        const normalized = asAgentiCOSError(error);
        const policy = this.options.retryPolicy ?? DEFAULT_RETRY_POLICY;
        const attempts = (claim.event.attempts ?? 0) + 1;
        const retryDelay = computeBackoff(
          policy,
          attempts,
          normalized.retryAfterMs,
        );
        const nextAttemptAt = new Date(
          nowMs + retryDelay,
        ).toISOString();

        await this.store.markFailed(
          claim.event.eventId,
          normalized,
          nextAttemptAt,
        );

        return {
          published,
          failed: true,
          deferred: claims.length - published - 1,
        };
      }
    }

    return {
      published,
      failed: false,
      deferred: 0,
    };
  }
}
