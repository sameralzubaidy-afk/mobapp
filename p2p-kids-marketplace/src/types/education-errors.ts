// FILE: p2p-kids-marketplace/src/types/education-errors.ts
// MODULE-18 V1 EDU-002: Education error classes (mobile-facing)

/**
 * Thrown when content validation fails (title/body length, invalid URL, etc.)
 * Used by services when reading malformed DB data
 */
export class ContentValidationError extends Error {
  public readonly code = 'CONTENT_VALIDATION';
  public readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'ContentValidationError';
    this.field = field;

    // Maintains proper stack trace for where our error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ContentValidationError);
    }
  }
}

/**
 * Analytics write failure error (warn-only)
 * This error is NEVER thrown — used for type-safe logging
 */
export class AnalyticsWriteError extends Error {
  public readonly code = 'ANALYTICS_WRITE_FAILED';
  public readonly eventType?: string;

  constructor(message: string, eventType?: string) {
    super(message);
    this.name = 'AnalyticsWriteError';
    this.eventType = eventType;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AnalyticsWriteError);
    }
  }
}
