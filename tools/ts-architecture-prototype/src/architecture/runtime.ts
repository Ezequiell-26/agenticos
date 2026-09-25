import { randomUUID } from "node:crypto";
import { AgentiCOSError } from "./errors.js";

export interface Clock {
  nowMs(): number;
  nowIso(): string;
}

export interface IdGenerator {
  next(): string;
}

export class SystemClock implements Clock {
  nowMs(): number {
    return Date.now();
  }

  nowIso(): string {
    return new Date(this.nowMs()).toISOString();
  }
}

export class SystemIdGenerator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}

export function assertNonEmpty(value: string, field: string): void {
  if (!value.trim()) {
    throw new AgentiCOSError(field + " cannot be empty.", {
      code: "VALUE_REQUIRED",
      category: "VALIDATION",
    });
  }
}

export function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new AgentiCOSError(field + " must be a positive integer.", {
      code: "POSITIVE_INTEGER_REQUIRED",
      category: "VALIDATION",
    });
  }
}

export function assertNonNegativeFinite(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new AgentiCOSError(field + " must be a finite non-negative number.", {
      code: "NON_NEGATIVE_FINITE_REQUIRED",
      category: "VALIDATION",
    });
  }
}
