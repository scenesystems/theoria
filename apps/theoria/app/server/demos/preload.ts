import { Cause, Clock, Effect, Option } from "effect"

import type { ErrorCode } from "../../contracts/error.js"
import type { Id as DemoId } from "../../contracts/id.js"
import type { ProgramPreview, ProgramPreviewEnvelope } from "../../contracts/program-preview.js"
import { RuntimeInfo } from "../config/runtime.js"

import { lookup } from "./registry.js"

const successEnvelope = (
  requestId: string,
  buildSha: string,
  durationMs: number,
  data: ProgramPreview
): ProgramPreviewEnvelope => ({
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
): ProgramPreviewEnvelope => ({
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
  data: ProgramPreview
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

export const preload = (id: DemoId, requestId: string) =>
  Effect.gen(function*() {
    const startedAtMs = yield* Clock.currentTimeMillis
    const runtimeInfo = yield* RuntimeInfo

    const definitionOption = lookup(id)

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
        definition.preload.pipe(
          Effect.flatMap((data) => successful(requestId, runtimeInfo.buildSha, startedAtMs, data)),
          Effect.catchAll((error) =>
            Effect.logError("theoria demo preload failed").pipe(
              Effect.annotateLogs("demoId", id),
              Effect.annotateLogs("requestId", requestId),
              Effect.annotateLogs("cause", Cause.pretty(Cause.fail(error))),
              Effect.zipRight(
                failed(
                  requestId,
                  runtimeInfo.buildSha,
                  startedAtMs,
                  "execution-failed",
                  "Demo preload failed.",
                  true
                )
              )
            )
          )
        )
    })
  })
