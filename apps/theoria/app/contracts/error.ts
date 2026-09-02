import { Schema } from "effect"

export const ErrorCode = Schema.Literal(
  "invalid-request",
  "method-not-allowed",
  "cross-site-request",
  "execution-failed",
  "route-not-found"
)

export type ErrorCode = typeof ErrorCode.Type

export const ErrorModel = Schema.Struct({
  code: ErrorCode,
  message: Schema.String,
  retryable: Schema.Boolean
})

export type ErrorModel = typeof ErrorModel.Type
