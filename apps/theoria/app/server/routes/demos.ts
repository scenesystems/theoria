import { HttpServerResponse } from "@effect/platform"
import { WorkflowEngine } from "@effect/workflow"
import { Effect, Match, Option, Schedule, Schema, Stream } from "effect"
import * as Arr from "effect/Array"
import type * as ParseResult from "effect/ParseResult"

import { encodeEvidenceEventJson, type EvidenceEvent } from "../../contracts/evidence-stream.js"
import { Id } from "../../contracts/id.js"
import { ProgramPreviewEnvelope } from "../../contracts/program-preview.js"
import { resolveRunWorkflowIdentity } from "../../contracts/run-plan.js"
import { RunEnvelope } from "../../contracts/run.js"
import { decodeStreamManifest, type StreamManifest } from "../../contracts/stream-manifest.js"
import { serverReleaseStage } from "../config/release-stage.js"

import { execute } from "../demos/executor.js"
import { preload } from "../demos/preload.js"
import { lookupForReleaseStage } from "../demos/registry.js"
import { DemoStreamSessionRegistry } from "../demos/stream-session-registry.js"

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

const invalidStreamRequestEnvelope = (requestId: string, message: string) => ({
  ok: false,
  meta: {
    requestId,
    buildSha: "unknown",
    durationMs: 0
  },
  error: {
    code: "invalid-query",
    message,
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

const isTerminalEvent = (event: EvidenceEvent): boolean =>
  event._tag === "StreamComplete" || event._tag === "StreamFailed"

const streamResponse = ({
  id,
  requestId,
  manifest,
  runToken
}: {
  readonly id: typeof Id.Type
  readonly requestId: string
  readonly manifest: StreamManifest | null
  readonly runToken: string
}) =>
  Effect.gen(function*() {
    const releaseStage = yield* serverReleaseStage
    const definition = lookupForReleaseStage(id, releaseStage)

    return Option.match(definition, {
      onNone: () => jsonResponse(invalidDemoEnvelope(requestId)),
      onSome: (def) =>
        Effect.gen(function*() {
          const request = {
            runToken,
            plan: {
              id: def.id,
              manifest
            }
          }
          const identity = yield* resolveRunWorkflowIdentity(request)
          const sessionKey = identity.requestFingerprint
          const registry = yield* DemoStreamSessionRegistry

          yield* registry.ensureSession(sessionKey)

          const executionId = yield* def.workflow.executionId(request)
          const started = yield* registry.markStarted({ executionId, sessionKey })
          const workflowEngine = started
            ? Option.some(yield* WorkflowEngine.WorkflowEngine)
            : Option.none()

          const startWorkflow = Option.match(workflowEngine, {
            onNone: () => Effect.void,
            onSome: (workflowEngine) =>
              def.workflow.execute(request).pipe(
                Effect.asVoid,
                Effect.catchAll(() => Effect.void),
                Effect.forkDaemon,
                Effect.asVoid,
                Effect.provideService(WorkflowEngine.WorkflowEngine, workflowEngine)
              )
          })

          const dataStream = Stream.unwrapScoped(
            registry.subscribe(sessionKey).pipe(Effect.tap(() => startWorkflow))
          ).pipe(Stream.takeUntil(isTerminalEvent), Stream.map(sseEvent))

          const sseStream = Stream.merge(dataStream, heartbeatStream, { haltStrategy: "left" })

          return HttpServerResponse.stream(sseStream, {
            headers: {
              "content-type": "text/event-stream",
              "cache-control": "no-cache",
              "connection": "keep-alive"
            }
          })
        })
    })
  })

const parseStreamQuery = (rawUrl: string | null):
  | { readonly _tag: "ParsedStreamQuery"; readonly manifest: StreamManifest | null; readonly runToken: string }
  | { readonly _tag: "InvalidStreamQuery"; readonly message: string } =>
{
  if (rawUrl === null) {
    return { _tag: "InvalidStreamQuery", message: "Streaming runs require a run token." }
  }

  const url = new URL(rawUrl, "http://127.0.0.1")
  const rawRunToken = url.searchParams.get("runToken")
  const rawManifest = url.searchParams.get("manifest")
  const manifest = rawManifest !== null && rawManifest.trim().length > 0
    ? Option.getOrElse(decodeStreamManifest(rawManifest.trim()), () => null)
    : null

  if (rawManifest !== null && rawManifest.trim().length > 0 && manifest === null) {
    return { _tag: "InvalidStreamQuery", message: "Stream manifest did not decode against the contract." }
  }

  if (rawRunToken === null || rawRunToken.trim().length === 0) {
    return { _tag: "InvalidStreamQuery", message: "Streaming runs require a run token." }
  }

  return {
    _tag: "ParsedStreamQuery",
    manifest,
    runToken: rawRunToken.trim()
  }
}

export const demoRoute = (pathname: string, requestId: string, rawUrl: string | null = null) =>
  decodeRoute(pathname).pipe(
    Effect.flatMap((route) =>
      Match.value(route.endpoint).pipe(
        Match.when(
          "stream",
          () =>
            Match.value(parseStreamQuery(rawUrl)).pipe(
              Match.tag(
                "InvalidStreamQuery",
                ({ message }) => Effect.succeed(jsonResponse(invalidStreamRequestEnvelope(requestId, message)))
              ),
              Match.tag(
                "ParsedStreamQuery",
                ({ manifest, runToken }) => streamResponse({ id: route.id, requestId, manifest, runToken })
              ),
              Match.exhaustive
            )
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
