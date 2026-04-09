import { Schema } from "effect"

export const ErrorCode = Schema.Literal(
  "invalid-entry-id",
  "invalid-package-id",
  "invalid-query",
  "execution-timeout",
  "execution-failed",
  "provider-unavailable",
  "route-not-found"
)

export type ErrorCode = typeof ErrorCode.Type

export class ErrorModel extends Schema.Class<ErrorModel>("ErrorModel")({
  code: ErrorCode,
  message: Schema.String,
  retryable: Schema.Boolean
}) {}
