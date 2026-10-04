import { Schema } from "effect"

import { ErrorModel } from "./error.js"

const NonNegativeNumber = Schema.Finite.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(0))
)

export const Metadata = Schema.Struct({
  requestId: Schema.String.pipe(Schema.check(Schema.isMinLength(1))),
  buildSha: Schema.String.pipe(Schema.check(Schema.isMinLength(1))),
  durationMs: NonNegativeNumber
})

export type Metadata = typeof Metadata.Type

export const Success = <S extends Schema.Top>(data: S) =>
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

export const Envelope = <S extends Schema.Top>(data: S) => Schema.Union([Success(data), Failure])
