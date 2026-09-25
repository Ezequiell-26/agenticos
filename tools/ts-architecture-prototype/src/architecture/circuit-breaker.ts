import { AgentiCOSError } from "./errors.js";
import { assertPositiveInteger } from "./runtime.js";

export type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerOptions {
  readonly failureThreshold: number;
  readonly cooldownMs: number;
}

export interface CircuitSnapshot {
  readonly state: CircuitState;
  readonly consecutiveFailures: number;
  readonly openedAtMs?: number;
  readonly probeInFlight: boolean;
}

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private consecutiveFailures = 0;
  private openedAtMs: number | undefined;
  private probeInFlight = false;

  constructor(private readonly options: CircuitBreakerOptions) {
    assertPositiveInteger(options.failureThreshold, "failureThreshold");
    assertPositiveInteger(options.cooldownMs, "cooldownMs");
  }

  snapshot(): CircuitSnapshot {
    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      ...(this.openedAtMs === undefined ? {} : { openedAtMs: this.openedAtMs }),
      probeInFlight: this.probeInFlight,
    };
  }

  allowRequest(nowMs = Date.now()): boolean {
    if (this.state === "closed") return true;

    if (this.state === "open") {
      if (this.openedAtMs === undefined || nowMs - this.openedAtMs < this.options.cooldownMs) {
        return false;
      }
      this.state = "half-open";
      this.probeInFlight = false;
    }

    if (this.state === "half-open") {
      if (this.probeInFlight) return false;
      this.probeInFlight = true;
      return true;
    }

    return false;
  }

  recordSuccess(): void {
    this.state = "closed";
    this.consecutiveFailures = 0;
    this.openedAtMs = undefined;
    this.probeInFlight = false;
  }

  recordFailure(nowMs = Date.now()): void {
    this.probeInFlight = false;
    this.consecutiveFailures += 1;

    if (this.consecutiveFailures >= this.options.failureThreshold) {
      this.state = "open";
      this.openedAtMs = nowMs;
    }
  }

  assertRequestAllowed(nowMs = Date.now()): void {
    if (this.allowRequest(nowMs)) return;

    throw new AgentiCOSError("Provider circuit is open.", {
      code: "CIRCUIT_OPEN",
      category: "PROVIDER",
      retryable: true,
      recoverable: true,
    });
  }
}
