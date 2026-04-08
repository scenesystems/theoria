import { Clock, Effect, Option } from "effect"

import type { EntryRunRequest } from "../../contracts/entry/registry.js"
import type { ErrorCode } from "../../contracts/error.js"
import type { RunData as DemoData, RunEnvelope as DemoResponseEnvelope } from "../../contracts/study/run.js"
import { serverReleaseStage } from "../config/release-stage.js"
import { RuntimeInfo } from "../config/runtime.js"
import { lookupForReleaseStage } from "./registry.js"
import type { EntryStreamRequest } from "./stream-request.js"

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

const streamRequestForRunRequest = (request: EntryRunRequest): EntryStreamRequest => ({
  runToken: request.runToken,
  draft: request.draft,
  plan: null
})

export const execute = (request: EntryRunRequest, requestId: string) =>
  Effect.gen(function*() {
    const startedAtMs = yield* Clock.currentTimeMillis
    const releaseStage = yield* serverReleaseStage
    const runtimeInfo = yield* RuntimeInfo

    const definitionOption = lookupForReleaseStage(request.draft.entryId, releaseStage)

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
        definition.workflow.execute(streamRequestForRunRequest(request)).pipe(
          Effect.flatMap((data) => successful(requestId, runtimeInfo.buildSha, startedAtMs, data)),
          Effect.catchAll((error) =>
            failed(
              requestId,
              runtimeInfo.buildSha,
              startedAtMs,
              error.code,
              error.message,
              error.retryable
            )
          )
        )
    })
  })
