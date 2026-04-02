import { Schema } from "effect"

import { ErrorCode } from "./error.js"

export class DemoRequestError extends Schema.TaggedError<DemoRequestError>()("DemoRequestError", {
  message: Schema.String
}) {}

export class DemoDecodeError extends Schema.TaggedError<DemoDecodeError>()("DemoDecodeError", {
  message: Schema.String
}) {}

export class DemoExecutionError extends Schema.TaggedError<DemoExecutionError>()("DemoExecutionError", {
  code: ErrorCode,
  message: Schema.String,
  retryable: Schema.Boolean
}) {}

export type DemoError = DemoRequestError | DemoDecodeError | DemoExecutionError

export const DemoError = Schema.Union(DemoRequestError, DemoDecodeError, DemoExecutionError)
