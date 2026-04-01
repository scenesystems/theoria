import { Schema } from "effect"

import { ErrorModel } from "./error.js"

const NonNegativeNumber = Schema.Number.pipe(
  Schema.finite(),
  Schema.greaterThanOrEqualTo(0)
)

export const Metadata = Schema.Struct({
  requestId: Schema.String.pipe(Schema.minLength(1)),
  buildSha: Schema.String.pipe(Schema.minLength(1)),
  durationMs: NonNegativeNumber
})

export type Metadata = typeof Metadata.Type

export const Success = <A, I, R>(data: Schema.Schema<A, I, R>) =>
  Schema.Struct({
    ok: Schema.Literal(true),
    meta: Metadata,
    data
  })

export const Failure = Schema.Struct({
  ok: Schema.Literal(false),
  meta: Metadata,
  error: ErrorModel
})

export type Failure = typeof Failure.Type

export const Envelope = <A, I, R>(data: Schema.Schema<A, I, R>) => Schema.Union(Success(data), Failure)
