import { Cause, Clock, Effect, Option, Schema } from "effect"

import type { ErrorCode } from "../../contracts/error.js"
import type { Id as DemoId } from "../../contracts/id.js"
import type { RunData as DemoData, RunEnvelope as DemoResponseEnvelope } from "../../contracts/run.js"
import { serverReleaseStage } from "../config/release-stage.js"
import { RuntimeInfo } from "../config/runtime.js"
import { DspProviderUnavailable } from "./effect-dsp/provider.js"
import { ExecutionPolicy } from "./policy.js"
import { lookupForReleaseStage } from "./registry.js"

const isProviderUnavailable = Schema.is(DspProviderUnavailable)

const successEnvelope = (
  requestId: string,
  buildSha: string,
  durationMs: number,
  data: DemoData
): DemoResponseEnvelope => ({
  ok: true,
  meta: {
    requestId,
    buildSha,
    durationMs
  },
  data
})

const failureEnvelope = (
  requestId: string,
  buildSha: string,
  durationMs: number,
  code: ErrorCode,
  message: string,
  retryable: boolean
): DemoResponseEnvelope => ({
  ok: false,
  meta: {
    requestId,
    buildSha,
    durationMs
  },
  error: {
    code,
    message,
    retryable
  }
})

const successful = (
  requestId: string,
  buildSha: string,
  startedAtMs: number,
  data: DemoData
) =>
  Effect.gen(function*() {
    const endedAtMs = yield* Clock.currentTimeMillis

    return successEnvelope(requestId, buildSha, endedAtMs - startedAtMs, data)
  })

const failed = (
  requestId: string,
  buildSha: string,
  startedAtMs: number,
  code: ErrorCode,
  message: string,
  retryable: boolean
) =>
  Effect.gen(function*() {
    const endedAtMs = yield* Clock.currentTimeMillis

    return failureEnvelope(
      requestId,
      buildSha,
      endedAtMs - startedAtMs,
      code,
      message,
      retryable
    )
  })

export const execute = (id: DemoId, requestId: string) =>
  Effect.gen(function*() {
    const startedAtMs = yield* Clock.currentTimeMillis
    const releaseStage = yield* serverReleaseStage
    const runtimeInfo = yield* RuntimeInfo
    const policy = yield* ExecutionPolicy

    const definitionOption = lookupForReleaseStage(id, releaseStage)

    return yield* Option.match(definitionOption, {
      onNone: () =>
        failed(
          requestId,
          runtimeInfo.buildSha,
          startedAtMs,
          "invalid-demo-id",
          "Requested demo does not exist.",
          false
        ),
      onSome: (definition) =>
        policy.withLane(definition.lane, definition.execute).pipe(
          Effect.timeoutOption(policy.timeoutMillis(definition.lane)),
          Effect.flatMap(
            Option.match({
              onNone: () =>
                failed(
                  requestId,
                  runtimeInfo.buildSha,
                  startedAtMs,
                  "execution-timeout",
                  "Demo execution timed out.",
                  true
                ),
              onSome: (data) => successful(requestId, runtimeInfo.buildSha, startedAtMs, data)
            })
          ),
          Effect.catchAll((error) =>
            isProviderUnavailable(error)
              ? failed(
                requestId,
                runtimeInfo.buildSha,
                startedAtMs,
                "provider-unavailable",
                error.message,
                false
              )
              : Effect.logError("theoria demo execution failed").pipe(
                Effect.annotateLogs("demoId", id),
                Effect.annotateLogs("requestId", requestId),
                Effect.annotateLogs("cause", Cause.pretty(Cause.fail(error))),
                Effect.zipRight(
                  failed(
                    requestId,
                    runtimeInfo.buildSha,
                    startedAtMs,
                    "execution-failed",
                    "Demo execution failed.",
                    true
                  )
                )
              )
          )
        )
    })
  })
