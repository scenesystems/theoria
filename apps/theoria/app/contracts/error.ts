import { Match, Schema } from "effect"

export const ErrorCode = Schema.Literal(
  "invalid-request",
  "method-not-allowed",
  "cross-site-request",
  "rate-limited",
  "execution-failed",
  "route-not-found"
)

export type ErrorCode = typeof ErrorCode.Type

/**
 * The HTTP status an error code is answered with: one authority, exhaustive
 * over the closed set, so a new code must be given its status here.
 */
export const httpStatus = (code: ErrorCode): number =>
  Match.value(code).pipe(
    Match.when("invalid-request", () => 400),
    Match.when("cross-site-request", () => 403),
    Match.when("route-not-found", () => 404),
    Match.when("method-not-allowed", () => 405),
    Match.when("rate-limited", () => 429),
    Match.when("execution-failed", () => 500),
    Match.exhaustive
  )

export const ErrorModel = Schema.Struct({
  code: ErrorCode,
  message: Schema.String,
  retryable: Schema.Boolean
})

export type ErrorModel = typeof ErrorModel.Type
