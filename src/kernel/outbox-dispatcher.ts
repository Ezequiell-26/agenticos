import { randomUUID } from "node:crypto";
import {
  DEFAULT_OUTBOX_CLAIM_TTL_MS,
  type DurableEvent,
} from "../architecture/outbox.js";
import { AgentiCOSError } from "../architecture/errors.js";
import { SqliteKernelStore } from "./sqlite-store.js";

export interface OutboxDispatcherOptions {
  readonly workerId?: string;
  readonly claimTtlMs?: number;
}

export interface OutboxDispatchResult {
  readonly published: number;
  readonly failed: boolean;
}

export class DurableOutboxDispatcher {
  private readonly workerId: string;
  private readonly claimTtlMs: number;

  constructor(
    private readonly store: SqliteKernelStore,
    options: OutboxDispatcherOptions = {},
  ) {
    this.workerId = options.workerId?.trim() || "outbox-" + randomUUID();
    this.claimTtlMs = options.claimTtlMs ?? DEFAULT_OUTBOX_CLAIM_TTL_MS;

    if (!Number.isInteger(this.claimTtlMs) || this.claimTtlMs <= 0) {
      throw new AgentiCOSError("Outbox dispatcher claimTtlMs must be a positive integer.", {
        code: "OUTBOX_DISPATCH_TTL_INVALID",
        category: "VALIDATION",
      });
    }
  }

  async dispatch(
    publish: (event: DurableEvent) => Promise<void> | void,
    limit = 100,
    nowMs = Date.now(),
  ): Promise<OutboxDispatchResult> {
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
      } catch {
        await this.store.releaseClaim(claim.event.eventId, claim.claimId);
        return { published, failed: true };
      }
    }

    return { published, failed: false };
  }
}
