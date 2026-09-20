import { createHash } from "node:crypto";
import { AgentiCOSError } from "./errors.js";

export interface IdempotencyRecord {
  readonly key: string;
  readonly operation: string;
  readonly fingerprint: string;
  readonly status: "in-progress" | "completed" | "failed";
  readonly result?: unknown;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface IdempotencyStore {
  get(key: string): Promise<IdempotencyRecord | undefined>;
  put(record: IdempotencyRecord): Promise<void>;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly records = new Map<string, IdempotencyRecord>();

  async get(key: string): Promise<IdempotencyRecord | undefined> {
    return this.records.get(key);
  }

  async put(record: IdempotencyRecord): Promise<void> {
    const existing = this.records.get(record.key);
    if (existing && existing.fingerprint !== record.fingerprint) {
      throw new AgentiCOSError("Idempotency key reused with a different operation.", {
        code: "IDEMPOTENCY_KEY_CONFLICT",
        category: "VALIDATION",
        recoverable: false,
      });
    }
    this.records.set(record.key, record);
  }
}

export function fingerprintOperation(operation: string, input: unknown): string {
  return createHash("sha256")
    .update(operation + "\n" + stableStringify(input))
    .digest("hex");
}

export async function executeIdempotent<T>(
  store: IdempotencyStore,
  operation: string,
  key: string,
  input: unknown,
  execute: () => Promise<T>,
): Promise<T> {
  const fingerprint = fingerprintOperation(operation, input);
  const now = new Date().toISOString();
  const existing = await store.get(key);

  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      throw new AgentiCOSError("Idempotency key conflict.", {
        code: "IDEMPOTENCY_KEY_CONFLICT",
        category: "VALIDATION",
      });
    }
    if (existing.status === "completed") return existing.result as T;
    if (existing.status === "in-progress") {
      throw new AgentiCOSError("Operation is already in progress.", {
        code: "IDEMPOTENCY_IN_PROGRESS",
        category: "CONCURRENCY",
        retryable: true,
        recoverable: true,
      });
    }
    throw new AgentiCOSError("Previous operation failed; explicit retry required.", {
      code: "IDEMPOTENCY_PREVIOUS_FAILURE",
      category: "VALIDATION",
    });
  }

  await store.put({
    key,
    operation,
    fingerprint,
    status: "in-progress",
    createdAt: now,
    updatedAt: now,
  });

  try {
    const result = await execute();
    await store.put({
      key,
      operation,
      fingerprint,
      status: "completed",
      result,
      createdAt: now,
      updatedAt: new Date().toISOString(),
    });
    return result;
  } catch (error) {
    await store.put({
      key,
      operation,
      fingerprint,
      status: "failed",
      createdAt: now,
      updatedAt: new Date().toISOString(),
    });
    throw error;
  }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  const record = value as Record<string, unknown>;
  return "{" + Object.keys(record).sort().map((key) =>
    JSON.stringify(key) + ":" + stableStringify(record[key])
  ).join(",") + "}";
}
