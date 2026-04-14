import { Schema } from "effect"

import type { ErrorCode } from "./error.js"
import { ErrorModel } from "./error.js"

const NonNegativeNumber = Schema.Number.pipe(
  Schema.finite(),
  Schema.greaterThanOrEqualTo(0)
)

export class Metadata extends Schema.Class<Metadata>("Metadata")({
  requestId: Schema.String.pipe(Schema.minLength(1)),
  buildSha: Schema.String.pipe(Schema.minLength(1)),
  durationMs: NonNegativeNumber
}) {
  static fromTiming(input: {
    readonly requestId: string
    readonly buildSha: string
    readonly startedAtMs: number
    readonly endedAtMs: number
  }): Metadata {
    return Metadata.make({
      requestId: input.requestId,
      buildSha: input.buildSha,
      durationMs: input.endedAtMs - input.startedAtMs
    })
  }
}

export class FailureEnvelope extends Schema.Class<FailureEnvelope>("FailureEnvelope")({
  ok: Schema.Literal(false),
  meta: Metadata,
  error: ErrorModel
}) {
  static fail(meta: Metadata, error: ErrorModel): FailureEnvelope {
    return FailureEnvelope.make({ ok: false, meta, error })
  }

  static fromError(
    meta: Metadata,
    input: {
      readonly code: ErrorCode
      readonly message: string
      readonly retryable: boolean
    }
  ): FailureEnvelope {
    return FailureEnvelope.fail(meta, ErrorModel.make(input))
  }
}
