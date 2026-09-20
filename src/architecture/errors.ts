export type ErrorCategory =
  | "AUTH" | "RATE_LIMIT" | "QUOTA" | "NETWORK" | "TIMEOUT" | "PROVIDER"
  | "TOOL" | "SANDBOX" | "POLICY" | "VALIDATION" | "PERSISTENCE" | "PLUGIN"
  | "PROTOCOL" | "RESOURCE" | "CONCURRENCY" | "SECURITY" | "BUG";

export type ErrorSeverity = "info" | "warning" | "error" | "critical";

export interface AgentiCOSErrorOptions {
  readonly code: string;
  readonly category: ErrorCategory;
  readonly severity?: ErrorSeverity;
  readonly retryable?: boolean;
  readonly recoverable?: boolean;
  readonly userActionRequired?: boolean;
  readonly retryAfterMs?: number;
  readonly cause?: unknown;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}

export class AgentiCOSError extends Error {
  readonly code: string;
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly retryable: boolean;
  readonly recoverable: boolean;
  readonly userActionRequired: boolean;
  readonly retryAfterMs: number | undefined;
  readonly metadata: Readonly<Record<string, string | number | boolean>> | undefined;

  constructor(message: string, options: AgentiCOSErrorOptions) {
    super(message, { cause: options.cause });
    this.name = "AgentiCOSError";
    this.code = options.code;
    this.category = options.category;
    this.severity = options.severity ?? "error";
    this.retryable = options.retryable ?? false;
    this.recoverable = options.recoverable ?? false;
    this.userActionRequired = options.userActionRequired ?? false;
    this.retryAfterMs = options.retryAfterMs;
    this.metadata = options.metadata;
  }
}

export function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof AgentiCOSError) {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      category: error.category,
      severity: error.severity,
      retryable: error.retryable,
      recoverable: error.recoverable,
      userActionRequired: error.userActionRequired,
      ...(error.retryAfterMs === undefined ? {} : { retryAfterMs: error.retryAfterMs }),
      ...(error.metadata === undefined ? {} : { metadata: error.metadata }),
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return { message: String(error) };
}

export function asAgentiCOSError(error: unknown): AgentiCOSError {
  if (error instanceof AgentiCOSError) return error;
  if (error instanceof Error) {
    return new AgentiCOSError(error.message, {
      code: "UNCLASSIFIED",
      category: "BUG",
      cause: error,
    });
  }
  return new AgentiCOSError(String(error), {
    code: "UNCLASSIFIED",
    category: "BUG",
  });
}
