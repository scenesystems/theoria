import { HttpServerResponse } from "@effect/platform"
import { Clock, Effect, Either, Match, Option, Schedule, Schema, Stream } from "effect"

import {
  Choreography,
  encodeEvidenceEventJson,
  type EvidenceEvent,
  SectionAppend,
  Step,
  StreamComplete,
  StreamFailed
} from "../../contracts/evidence-stream.js"
import type { Id } from "../../contracts/id.js"
import type { StreamManifest } from "../../contracts/stream-manifest.js"
import { serverReleaseStage } from "../config/release-stage.js"
import { RuntimeInfo } from "../config/runtime.js"
import { DspProviderRuntime } from "../demos/effect-dsp/provider.js"
import { ExecutionPolicy, ExecutionTimedOut } from "../demos/policy.js"
import { lookupForReleaseStage } from "../demos/registry.js"
import type { StreamElement } from "../demos/stream-element.js"

const isExecutionTimedOut = Schema.is(ExecutionTimedOut)
const encoder = new TextEncoder()
const heartbeat = encoder.encode(`: heartbeat\n\n`)
const heartbeatStream = Stream.repeat(Stream.make(heartbeat), Schedule.spaced("8 seconds"))

const failureTag = (error: unknown): string =>
  typeof error === "object" && error !== null && "_tag" in error && typeof error._tag === "string"
    ? error._tag
    : "UnknownFailure"

const sseEvent = (event: EvidenceEvent): Uint8Array =>
  encoder.encode(`event: evidence\ndata: ${encodeEvidenceEventJson(event)}\n\n`)

const elementToEvent = (element: StreamElement): EvidenceEvent =>
  Match.value(element).pipe(
    Match.when({ _tag: "cue" }, ({ cue }) => new Choreography({ cue })),
    Match.when({ _tag: "step" }, ({ step }) => new Step({ step })),
    Match.orElse(({ section }) => new SectionAppend({ section }))
  )

const failureEvent = (error: unknown): StreamFailed =>
  isExecutionTimedOut(error)
    ? new StreamFailed({
      error: {
        code: "execution-timeout",
        message: "Demo stream timed out.",
        retryable: true
      }
    })
    : new StreamFailed({
      error: {
        code: "execution-failed",
        message: "Demo stream failed.",
        retryable: true
      }
    })

const unavailableResponse = (requestId: string, buildSha: string, code: "invalid-demo-id" | "rate-limited") =>
  HttpServerResponse.json(
    {
      ok: false,
      meta: { requestId, buildSha, durationMs: 0 },
      error: {
        code,
        message: code === "rate-limited"
          ? "Demo execution capacity is currently full."
          : "Requested demo does not exist.",
        retryable: code === "rate-limited"
      }
    },
    {
      status: code === "rate-limited" ? 429 : 404,
      headers: {
        "cache-control": "no-store",
        ...(code === "rate-limited" ? { "retry-after": "1" } : {})
      }
    }
  )

export const streamResponse = (id: Id, requestId: string, manifest: StreamManifest | null) =>
  Effect.gen(function*() {
    const startedAtMs = yield* Clock.currentTimeMillis
    const releaseStage = yield* serverReleaseStage
    const runtimeInfo = yield* RuntimeInfo
    const dspRuntime = yield* DspProviderRuntime
    const policy = yield* ExecutionPolicy
    const definition = lookupForReleaseStage(id, releaseStage)

    if (Option.isNone(definition)) {
      return yield* unavailableResponse(requestId, runtimeInfo.buildSha, "invalid-demo-id")
    }

    const lane = definition.value.lane
    const acquired = yield* Effect.either(policy.acquireLane(lane))

    if (Either.isLeft(acquired)) {
      return yield* unavailableResponse(requestId, runtimeInfo.buildSha, "rate-limited")
    }

    const elements = definition.value.streamElements(manifest, dspRuntime)

    if (elements === null) {
      return yield* unavailableResponse(requestId, runtimeInfo.buildSha, "invalid-demo-id")
    }

    const governedElements = policy.timeoutStream(lane, elements)
    const dataStream = Stream.concat(
      Stream.map(governedElements, elementToEvent),
      Stream.fromEffect(
        Effect.gen(function*() {
          if (lane === "provider") {
            yield* dspRuntime.markOperational
          }

          const endedAtMs = yield* Clock.currentTimeMillis

          return new StreamComplete({
            summary: definition.value.card.summary,
            meta: {
              requestId,
              buildSha: runtimeInfo.buildSha,
              durationMs: endedAtMs - startedAtMs
            }
          })
        })
      )
    ).pipe(
      Stream.catchAll((error) =>
        Stream.fromEffect(
          Effect.logWarning("theoria demo stream failed").pipe(
            Effect.annotateLogs("demoId", id),
            Effect.annotateLogs("requestId", requestId),
            Effect.annotateLogs("failureTag", failureTag(error)),
            Effect.zipRight(lane === "provider" ? dspRuntime.markDegraded : Effect.void),
            Effect.as(failureEvent(error))
          )
        )
      ),
      Stream.map(sseEvent)
    )
    const sseStream = Stream.merge(dataStream, heartbeatStream, { haltStrategy: "left" })

    return HttpServerResponse.stream(sseStream, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        "connection": "keep-alive"
      }
    })
  })
