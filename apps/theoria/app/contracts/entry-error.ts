import { Schema } from "effect"
import * as ParseResult from "effect/ParseResult"

import type { ErrorModel } from "./error.js"
import { ErrorCode } from "./error.js"

export class EntryRequestError extends Schema.TaggedError<EntryRequestError>()("EntryRequestError", {
  message: Schema.String
}) {
  static fromMessage(message: string): EntryRequestError {
    return new EntryRequestError({ message })
  }
}

export class EntryDecodeError extends Schema.TaggedError<EntryDecodeError>()("EntryDecodeError", {
  message: Schema.String
}) {
  static fromParseError(error: ParseResult.ParseError): EntryDecodeError {
    return new EntryDecodeError({
      message: ParseResult.TreeFormatter.formatErrorSync(error)
    })
  }
}

export class EntryExecutionError extends Schema.TaggedError<EntryExecutionError>()("EntryExecutionError", {
  code: ErrorCode,
  message: Schema.String,
  retryable: Schema.Boolean
}) {
  static fromErrorModel(error: ErrorModel): EntryExecutionError {
    return new EntryExecutionError({
      code: error.code,
      message: error.message,
      retryable: error.retryable
    })
  }
}

export type EntryError = EntryRequestError | EntryDecodeError | EntryExecutionError

export const EntryError = Schema.Union(EntryRequestError, EntryDecodeError, EntryExecutionError)
