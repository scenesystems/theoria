import { HttpServerResponse } from "@effect/platform"
import { Clock, Effect, Match, Option, Schema, Stream } from "effect"
import * as Arr from "effect/Array"
import type * as ParseResult from "effect/ParseResult"

import {
  encodeEvidenceEventJson,
  type EvidenceEvent,
  SectionAppend,
  StreamComplete,
  StreamFailed
} from "../../contracts/evidence-stream.js"
import { Id } from "../../contracts/id.js"
import { ProgramPreviewEnvelope } from "../../contracts/program-preview.js"
import { RunEnvelope } from "../../contracts/run.js"
import { RuntimeInfo } from "../config/runtime.js"

import { execute } from "../demos/executor.js"
import { preload } from "../demos/preload.js"
import { lookup } from "../demos/registry.js"

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

const encoder = new TextEncoder()

const sseEvent = (event: EvidenceEvent): Uint8Array =>
  encoder.encode(`event: evidence\ndata: ${encodeEvidenceEventJson(event)}\n\n`)

const describeStreamFailure = (error: unknown): string => {
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    const message = error.message.trim()

    return message.length > 0 ? message : "Demo stream failed."
  }

  return "Demo stream failed."
}

const streamResponse = (id: typeof Id.Type, requestId: string, customText: string | null = null) =>
  Effect.gen(function*() {
    const startedAtMs = yield* Clock.currentTimeMillis
    const runtimeInfo = yield* RuntimeInfo
    const definition = lookup(id)

    return Option.match(definition, {
      onNone: () => jsonResponse(failureEnvelope(requestId)),
      onSome: (def) => {
        const sections = def.streamSections(customText === null ? undefined : customText)

        if (sections === null) {
          return jsonResponse(failureEnvelope(requestId))
        }

        const sseStream = Stream.concat(
          sections.pipe(Stream.map((section) => new SectionAppend({ section }))),
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

const parseCustomText = (rawUrl: string | null): string | null =>
  Match.value(rawUrl).pipe(
    Match.when(null, () => null),
    Match.orElse((resolvedUrl) => {
      const value = new URL(resolvedUrl, "http://127.0.0.1").searchParams.get("customText")
      return value !== null && value.trim().length > 0 ? value.trim() : null
    })
  )

export const demoRoute = (pathname: string, requestId: string, rawUrl: string | null = null) =>
  decodeRoute(pathname).pipe(
    Effect.flatMap((route) =>
      Match.value(route.endpoint).pipe(
        Match.when(
          "stream",
          () => streamResponse(route.id, requestId, parseCustomText(rawUrl))
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
    Effect.catchAll(() => Effect.succeed(jsonResponse(failureEnvelope(requestId))))
  )
