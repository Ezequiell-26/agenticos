import { AgentiCOSError } from "./errors.js";

export interface CancellationToken {
  readonly signal: AbortSignal;
  isCancelled(): boolean;
  reason(): unknown;
  throwIfCancelled(): void;
}

export class CancellationController implements CancellationToken {
  private readonly controller = new AbortController();

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  isCancelled(): boolean {
    return this.controller.signal.aborted;
  }

  reason(): unknown {
    return this.controller.signal.reason;
  }

  cancel(reason = "cancelled"): void {
    if (!this.controller.signal.aborted) this.controller.abort(reason);
  }

  throwIfCancelled(): void {
    if (!this.controller.signal.aborted) return;

    throw new AgentiCOSError("Execution was cancelled.", {
      code: "EXECUTION_CANCELLED",
      category: "RESOURCE",
      recoverable: true,
      metadata: { reason: String(this.controller.signal.reason ?? "cancelled") },
    });
  }
}

export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return;
  throw new AgentiCOSError("Operation was cancelled.", {
    code: "OPERATION_CANCELLED",
    category: "RESOURCE",
    recoverable: true,
    metadata: { reason: String(signal.reason ?? "cancelled") },
  });
}
