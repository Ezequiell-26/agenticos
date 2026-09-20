import { randomUUID } from "node:crypto";
import { AgentiCOSError } from "./errors.js";

export interface Lease {
  readonly resourceId: string;
  readonly leaseId: string;
  readonly ownerId: string;
  readonly fencingToken: number;
  readonly acquiredAt: string;
  readonly expiresAt: string;
}

export class InMemoryLeaseManager {
  private readonly leases = new Map<string, Lease>();
  private token = 0;

  acquire(resourceId: string, ownerId: string, ttlMs: number, now = Date.now()): Lease {
    const existing = this.leases.get(resourceId);
    if (existing && new Date(existing.expiresAt).getTime() > now) {
      throw new AgentiCOSError("Resource is already leased.", {
        code: "LEASE_UNAVAILABLE",
        category: "CONCURRENCY",
        retryable: true,
        recoverable: true,
      });
    }

    const lease: Lease = {
      resourceId,
      leaseId: randomUUID(),
      ownerId,
      fencingToken: ++this.token,
      acquiredAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString(),
    };
    this.leases.set(resourceId, lease);
    return lease;
  }

  renew(lease: Lease, ttlMs: number, now = Date.now()): Lease {
    this.assertOwner(lease, now);
    const renewed = {
      ...lease,
      expiresAt: new Date(now + ttlMs).toISOString(),
    };
    this.leases.set(lease.resourceId, renewed);
    return renewed;
  }

  release(lease: Lease, now = Date.now()): void {
    this.assertOwner(lease, now, false);
    this.leases.delete(lease.resourceId);
  }

  assertOwner(lease: Lease, now = Date.now(), requireUnexpired = true): void {
    const current = this.leases.get(lease.resourceId);
    if (!current || current.leaseId !== lease.leaseId || current.fencingToken !== lease.fencingToken) {
      throw new AgentiCOSError("Lease ownership is no longer valid.", {
        code: "LEASE_FENCING_REJECTED",
        category: "CONCURRENCY",
        recoverable: true,
      });
    }
    if (requireUnexpired && new Date(current.expiresAt).getTime() <= now) {
      throw new AgentiCOSError("Lease expired.", {
        code: "LEASE_EXPIRED",
        category: "CONCURRENCY",
        recoverable: true,
        retryable: true,
      });
    }
  }
}
