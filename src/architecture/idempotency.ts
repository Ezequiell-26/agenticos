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
  claim(record: IdempotencyRecord): Promise<IdempotencyRecord | undefined>;
  put(record: IdempotencyRecord): Promise<void>;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly records = new Map<string, IdempotencyRecord>();

  async claim(record: IdempotencyRecord): Promise<IdempotencyRecord | undefined> {
    validateRecord(record);
    const existing = this.records.get(record.key);
    if (existing) {
      if (
        existing.fingerprint !== record.fingerprint ||
        existing.operation !== record.operation
      ) {
        throw new AgentiCOSError("Idempotency key reused with a different operation.", {
          code: "IDEMPOTENCY_KEY_CONFLICT",
          category: "VALIDATION",
        });
      }
      return existing;
    }

    this.records.set(record.key, record);
    return undefined;
  }

  async put(record: IdempotencyRecord): Promise<void> {
    validateRecord(record);
    const existing = this.records.get(record.key);
    if (
      existing &&
      (existing.fingerprint !== record.fingerprint ||
        existing.operation !== record.operation)
    ) {
      throw new AgentiCOSError("Idempotency key reused with a different operation.", {
        code: "IDEMPOTENCY_KEY_CONFLICT",
        category: "VALIDATION",
      });
    }
    this.records.set(record.key, record);
  }
}

export function fingerprintOperation(operation: string, input: unknown): string {
  if (!operation.trim()) {
    throw new AgentiCOSError("Idempotency operation is required.", {
      code: "IDEMPOTENCY_OPERATION_REQUIRED",
      category: "VALIDATION",
    });
  }

  return createHash("sha256")
    .update(operation + "\n" + canonicalize(input))
    .digest("hex");
}

export async function executeIdempotent<T>(
  store: IdempotencyStore,
  operation: string,
  key: string,
  input: unknown,
  execute: () => Promise<T>,
): Promise<T> {
  if (!key.trim()) {
    throw new AgentiCOSError("Idempotency key is required.", {
      code: "IDEMPOTENCY_KEY_REQUIRED",
      category: "VALIDATION",
    });
  }

  const fingerprint = fingerprintOperation(operation, input);
  const now = new Date().toISOString();
  const claimed = await store.claim({
    key,
    operation,
    fingerprint,
    status: "in-progress",
    createdAt: now,
    updatedAt: now,
  });

  if (claimed) {
    if (claimed.status === "completed") return claimed.result as T;
    if (claimed.status === "in-progress") {
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
      userActionRequired: true,
    });
  }

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

function validateRecord(record: IdempotencyRecord): void {
  if (!record.key.trim() || !record.operation.trim() || !record.fingerprint.trim()) {
    throw new AgentiCOSError("Idempotency record key, operation and fingerprint are required.", {
      code: "IDEMPOTENCY_RECORD_INVALID",
      category: "VALIDATION",
    });
  }
}

function canonicalize(value: unknown, seen = new WeakSet<object>()): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return JSON.stringify(["string", value]);
  if (typeof value === "boolean") return JSON.stringify(["boolean", value]);
  if (typeof value === "number") {
    if (Number.isNaN(value)) return JSON.stringify(["number", "NaN"]);
    if (value === Infinity) return JSON.stringify(["number", "Infinity"]);
    if (value === -Infinity) return JSON.stringify(["number", "-Infinity"]);
    if (Object.is(value, -0)) return JSON.stringify(["number", "-0"]);
    return JSON.stringify(["number", value]);
  }
  if (typeof value === "bigint") return JSON.stringify(["bigint", value.toString()]);
  if (typeof value === "function" || typeof value === "symbol") {
    throw new AgentiCOSError("Idempotency input contains an unsupported value type.", {
      code: "IDEMPOTENCY_INPUT_UNSUPPORTED",
      category: "VALIDATION",
    });
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new AgentiCOSError("Idempotency input contains an invalid Date.", {
        code: "IDEMPOTENCY_INPUT_UNSUPPORTED",
        category: "VALIDATION",
      });
    }
    return JSON.stringify(["date", value.toISOString()]);
  }

  if (seen.has(value)) {
    throw new AgentiCOSError("Idempotency input contains a circular reference.", {
      code: "IDEMPOTENCY_INPUT_CIRCULAR",
      category: "VALIDATION",
    });
  }
  seen.add(value);

  try {
    if (Array.isArray(value)) {
      return "[" + value.map((item) => canonicalize(item, seen)).join(",") + "]";
    }

    const record = value as Record<string, unknown>;
    return "{" + Object.keys(record).sort().map((key) =>
      JSON.stringify(key) + ":" + canonicalize(record[key], seen)
    ).join(",") + "}";
  } finally {
    seen.delete(value);
  }
}
