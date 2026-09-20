import { asAgentiCOSError, AgentiCOSError } from "./errors.js";
import { throwIfAborted } from "./cancellation.js";

export interface RetryContext {
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly error: AgentiCOSError;
}

export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly jitterRatio?: number;
  readonly shouldRetry?: (context: RetryContext) => boolean;
}

export interface RetryOptions {
  readonly signal?: AbortSignal;
  readonly sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

export async function retryAsync<T>(
  operation: (attempt: number) => Promise<T>,
  policy: RetryPolicy,
  options: RetryOptions = {},
): Promise<T> {
  validateRetryPolicy(policy);

  const sleep = options.sleep ?? defaultSleep;
  let attempt = 0;

  while (true) {
    throwIfAborted(options.signal);
    attempt += 1;

    try {
      return await operation(attempt);
    } catch (error) {
      const normalized = asAgentiCOSError(error);
      const context: RetryContext = { attempt, maxAttempts: policy.maxAttempts, error: normalized };

      if (
        attempt >= policy.maxAttempts ||
        !normalized.retryable ||
        !(policy.shouldRetry?.(context) ?? true)
      ) {
        throw normalized;
      }

      await sleep(computeBackoff(policy, attempt, normalized.retryAfterMs), options.signal);
    }
  }
}

export function computeBackoff(
  policy: RetryPolicy,
  attempt: number,
  retryAfterMs?: number,
): number {
  const exponential = Math.min(
    policy.maxDelayMs,
    policy.baseDelayMs * 2 ** Math.max(0, attempt - 1),
  );
  const jitterRatio = policy.jitterRatio ?? 0;
  const jitter = jitterRatio === 0 ? 0 : (Math.random() * 2 - 1) * jitterRatio;
  const computed = Math.max(0, Math.round(exponential * (1 + jitter)));
  return retryAfterMs === undefined ? computed : Math.max(computed, retryAfterMs);
}

function validateRetryPolicy(policy: RetryPolicy): void {
  if (!Number.isInteger(policy.maxAttempts) || policy.maxAttempts <= 0) {
    throw new AgentiCOSError("Retry maxAttempts must be positive.", {
      code: "RETRY_POLICY_INVALID",
      category: "VALIDATION",
    });
  }
  if (!Number.isFinite(policy.baseDelayMs) || policy.baseDelayMs < 0) {
    throw new AgentiCOSError("Retry baseDelayMs must be non-negative.", {
      code: "RETRY_POLICY_INVALID",
      category: "VALIDATION",
    });
  }
  if (!Number.isFinite(policy.maxDelayMs) || policy.maxDelayMs < policy.baseDelayMs) {
    throw new AgentiCOSError("Retry maxDelayMs must be >= baseDelayMs.", {
      code: "RETRY_POLICY_INVALID",
      category: "VALIDATION",
    });
  }

  const jitterRatio = policy.jitterRatio ?? 0;
  if (!Number.isFinite(jitterRatio) || jitterRatio < 0 || jitterRatio > 1) {
    throw new AgentiCOSError("Retry jitterRatio must be between 0 and 1.", {
      code: "RETRY_POLICY_INVALID",
      category: "VALIDATION",
    });
  }
}

async function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    if (!signal) return;

    const onAbort = () => {
      clearTimeout(timer);
      reject(new AgentiCOSError("Operation was cancelled.", {
        code: "OPERATION_CANCELLED",
        category: "RESOURCE",
        recoverable: true,
        metadata: { reason: String(signal.reason ?? "cancelled") },
      }));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
