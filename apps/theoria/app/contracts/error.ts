import { Schema } from "effect"

export const ErrorCode = Schema.Literal(
  "invalid-demo-id",
  "execution-timeout",
  "execution-failed",
  "provider-unavailable",
  "route-not-found"
)

export type ErrorCode = typeof ErrorCode.Type

export const ErrorModel = Schema.Struct({
  code: ErrorCode,
  message: Schema.String,
  retryable: Schema.Boolean
})

export type ErrorModel = typeof ErrorModel.Type
