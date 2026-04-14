import { Clock, Data, Effect } from "effect"

import { FailureEnvelope, Metadata } from "../../contracts/envelope.js"
import type { ErrorCode } from "../../contracts/error.js"
import { RuntimeInfo } from "../config/runtime.js"

type ResponseFailure = {
  readonly code: ErrorCode
  readonly message: string
  readonly retryable: boolean
}

export class ResponseTiming extends Data.Class<{
  readonly requestId: string
  readonly buildSha: string
  readonly startedAtMs: number
}> {
  static start(requestId: string) {
    return Effect.gen(function*() {
      const runtimeInfo = yield* RuntimeInfo
      const startedAtMs = yield* Clock.currentTimeMillis

      return new ResponseTiming({
        requestId,
        buildSha: runtimeInfo.buildSha,
        startedAtMs
      })
    })
  }

  finish(): Effect.Effect<Metadata> {
    const timing = this

    return Effect.gen(function*() {
      const endedAtMs = yield* Clock.currentTimeMillis

      return Metadata.fromTiming({
        requestId: timing.requestId,
        buildSha: timing.buildSha,
        startedAtMs: timing.startedAtMs,
        endedAtMs
      })
    })
  }

  fail(input: ResponseFailure): Effect.Effect<FailureEnvelope> {
    return this.finish().pipe(
      Effect.map((meta) => FailureEnvelope.fromError(meta, input))
    )
  }
}
