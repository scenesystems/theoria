import { HttpServerResponse } from "@effect/platform"
import { Clock, Effect, Match, Option, Schedule, Schema, Stream } from "effect"
import * as Arr from "effect/Array"
import type * as ParseResult from "effect/ParseResult"

import {
  Choreography,
  encodeEvidenceEventJson,
  type EvidenceEvent,
  SectionAppend,
  Step,
  StreamComplete,
  StreamFailed
} from "../../contracts/evidence-stream.js"
import { Id } from "../../contracts/id.js"
import { ProgramPreviewEnvelope } from "../../contracts/program-preview.js"
import { RunEnvelope } from "../../contracts/run.js"
import { decodeStreamManifest, type StreamManifest } from "../../contracts/stream-manifest.js"
import { serverReleaseStage } from "../config/release-stage.js"
import { RuntimeInfo } from "../config/runtime.js"

import { execute } from "../demos/executor.js"
import { preload } from "../demos/preload.js"
import { lookupForReleaseStage } from "../demos/registry.js"
import type { StreamElement } from "../demos/stream-element.js"

const DemoEndpoint = Schema.Literal("run", "preload", "stream")

const DemoRoute = Schema.Struct({
  id: Id,
  endpoint: DemoEndpoint
})

type DemoRoute = typeof DemoRoute.Type

class InvalidDemoRoute extends Schema.TaggedError<InvalidDemoRoute>()(
  "InvalidDemoRoute",
  {
    pathname: Schema.String
  }
) {}

const routePattern = /^\/api\/demos\/([^/]+)\/(run|preload|stream)$/u

const rawRoute = (pathname: string): Option.Option<{ readonly id: string; readonly endpoint: string }> =>
  Option.fromNullable(routePattern.exec(pathname)).pipe(
    Option.flatMap((matches) =>
      Option.zipWith(
        Arr.get(matches, 1),
        Arr.get(matches, 2),
        (id, endpoint) => ({
          id,
          endpoint
        })
      )
    )
  )

const decodeRoute = (pathname: string): Effect.Effect<DemoRoute, InvalidDemoRoute | ParseResult.ParseError> =>
  Option.match(rawRoute(pathname), {
    onNone: () => Effect.fail(new InvalidDemoRoute({ pathname })),
    onSome: (route) => Schema.decodeUnknown(DemoRoute)(route)
  })

const statusFromEnvelope = (envelope: { readonly ok: boolean; readonly error?: { readonly code: string } }): number =>
  Match.value(envelope.ok).pipe(
    Match.when(true, () => 200),
    Match.orElse(() =>
      Match.value(envelope.error?.code).pipe(
        Match.when("invalid-demo-id", () => 404),
        Match.when("route-not-found", () => 404),
        Match.orElse(() => 500)
      )
    )
  )

const jsonResponse = <A extends { readonly ok: boolean; readonly error?: { readonly code: string } }>(body: A) =>
  HttpServerResponse.json(body, {
    status: statusFromEnvelope(body),
    headers: {
      "cache-control": "no-store"
    }
  })

const failureEnvelope = (requestId: string) => ({
  ok: false,
  meta: {
    requestId,
    buildSha: "unknown",
    durationMs: 0
  },
  error: {
    code: "route-not-found",
    message: "Demo route must be /api/demos/:id/run, /api/demos/:id/preload, or /api/demos/:id/stream.",
    retryable: false
  }
})

const invalidDemoEnvelope = (requestId: string) => ({
  ok: false,
  meta: {
    requestId,
    buildSha: "unknown",
    durationMs: 0
  },
  error: {
    code: "invalid-demo-id",
    message: "Requested demo does not exist.",
    retryable: false
  }
})

const executionFailureEnvelope = (requestId: string) => ({
  ok: false,
  meta: {
    requestId,
    buildSha: "unknown",
    durationMs: 0
  },
  error: {
    code: "execution-failed",
    message: "Demo execution failed.",
    retryable: true
  }
})

const encoder = new TextEncoder()

const sseEvent = (event: EvidenceEvent): Uint8Array =>
  encoder.encode(`event: evidence\ndata: ${encodeEvidenceEventJson(event)}\n\n`)

// SSE comment heartbeat keeps the connection alive through proxies with
// idle timeouts (Railway: 60s keep-alive). Comment lines are ignored by
// EventSource clients per the SSE spec.
const sseHeartbeat = encoder.encode(`: heartbeat\n\n`)
const heartbeatStream = Stream.repeat(Stream.make(sseHeartbeat), Schedule.spaced("8 seconds"))

const describeStreamFailure = (error: unknown): string => {
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    const message = error.message.trim()

    return message.length > 0 ? message : "Demo stream failed."
  }

  return "Demo stream failed."
}

const elementToEvent = (element: StreamElement): EvidenceEvent =>
  Match.value(element).pipe(
    Match.when({ _tag: "cue" }, ({ cue }) => new Choreography({ cue })),
    Match.when({ _tag: "step" }, ({ step }) => new Step({ step })),
    Match.orElse(({ section }) => new SectionAppend({ section }))
  )

const streamResponse = (id: typeof Id.Type, requestId: string, manifest: StreamManifest | null) =>
  Effect.gen(function*() {
    const startedAtMs = yield* Clock.currentTimeMillis
    const releaseStage = yield* serverReleaseStage
    const runtimeInfo = yield* RuntimeInfo
    const definition = lookupForReleaseStage(id, releaseStage)

    return Option.match(definition, {
      onNone: () => jsonResponse(invalidDemoEnvelope(requestId)),
      onSome: (def) => {
        const elements = def.streamElements(manifest)

        if (elements === null) {
          return jsonResponse(failureEnvelope(requestId))
        }

        const dataStream = Stream.concat(
          Stream.map(elements, elementToEvent),
          Stream.fromEffect(
            Effect.gen(function*() {
              const endedAtMs = yield* Clock.currentTimeMillis

              return new StreamComplete({
                summary: def.card.summary,
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
            Stream.make(
              new StreamFailed({
                error: {
                  code: "execution-failed",
                  message: describeStreamFailure(error),
                  retryable: true
                }
              })
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
      }
    })
  })

const parseManifest = (rawUrl: string | null): StreamManifest | null =>
  Match.value(rawUrl).pipe(
    Match.when(null, (): StreamManifest | null => null),
    Match.orElse((resolvedUrl): StreamManifest | null => {
      const raw = new URL(resolvedUrl, "http://127.0.0.1").searchParams.get("manifest")

      return raw !== null && raw.trim().length > 0
        ? Option.getOrElse(decodeStreamManifest(raw.trim()), () => null)
        : null
    })
  )

export const demoRoute = (pathname: string, requestId: string, rawUrl: string | null = null) =>
  decodeRoute(pathname).pipe(
    Effect.flatMap((route) =>
      Match.value(route.endpoint).pipe(
        Match.when(
          "stream",
          () => streamResponse(route.id, requestId, parseManifest(rawUrl))
        ),
        Match.when("run", () =>
          execute(route.id, requestId).pipe(
            Effect.flatMap((envelope) => Schema.decodeUnknown(RunEnvelope)(envelope)),
            Effect.map(jsonResponse)
          )),
        Match.orElse(() =>
          preload(route.id, requestId).pipe(
            Effect.flatMap((envelope) => Schema.decodeUnknown(ProgramPreviewEnvelope)(envelope)),
            Effect.map(jsonResponse)
          )
        )
      )
    ),
    Effect.catchAll((error) =>
      error instanceof InvalidDemoRoute
        ? Effect.succeed(jsonResponse(failureEnvelope(requestId)))
        : Effect.logError("theoria demo route failed").pipe(
          Effect.annotateLogs("pathname", pathname),
          Effect.annotateLogs("requestId", requestId),
          Effect.annotateLogs("error", String(error)),
          Effect.zipRight(
            Effect.succeed(jsonResponse(executionFailureEnvelope(requestId)))
          )
        )
    )
  )
