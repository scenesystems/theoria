import { HttpServerRequest, HttpServerResponse } from "@effect/platform"
import { WorkflowEngine } from "@effect/workflow"
import { Effect, Match, Option, Schedule, Schema, Stream } from "effect"
import * as Arr from "effect/Array"
import type * as ParseResult from "effect/ParseResult"

import { EntryId, type RunnableEntryId } from "../../contracts/entry/id.js"
import { type EntryRunRequest, EntryRunRequest as EntryRunRequestSchema } from "../../contracts/entry/registry.js"
import { decodeStreamManifest, type StreamManifest } from "../../contracts/evidence/manifest.js"
import { encodeEvidenceEventJson, type EvidenceEvent } from "../../contracts/evidence/stream.js"
import { ProgramPreviewEnvelope } from "../../contracts/presentation/program-preview.js"
import { RunEnvelope } from "../../contracts/study/run.js"
import { serverReleaseStage } from "../config/release-stage.js"
import { execute } from "../kernel/definition.js"
import { EntryStreamSessionRegistry } from "../kernel/kinds/stream-session-registry.js"
import { preload } from "../kernel/preload.js"
import { lookupForReleaseStage } from "../kernel/registry.js"
import { type EntryStreamRequest, resolveEntryStreamRequestFingerprint } from "../kernel/stream-request.js"

const EntryEndpoint = Schema.Literal("run", "preload", "stream")

const EntryRoute = Schema.Struct({
  id: EntryId,
  endpoint: EntryEndpoint
})

type EntryRoute = typeof EntryRoute.Type

const EntryRunRequestJson = Schema.parseJson(EntryRunRequestSchema)

class InvalidEntryRoute extends Schema.TaggedError<InvalidEntryRoute>()(
  "InvalidEntryRoute",
  {
    pathname: Schema.String
  }
) {}

const routePattern = /^\/api\/entries\/([^/]+)\/(run|preload|stream)$/u

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

const decodeRoute = (pathname: string): Effect.Effect<EntryRoute, InvalidEntryRoute | ParseResult.ParseError> =>
  Option.match(rawRoute(pathname), {
    onNone: () => Effect.fail(new InvalidEntryRoute({ pathname })),
    onSome: (route) => Schema.decodeUnknown(EntryRoute)(route)
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
    message: "Entry route must be /api/entries/:id/run, /api/entries/:id/preload, or /api/entries/:id/stream.",
    retryable: false
  }
})

const invalidEntryEnvelope = (requestId: string) => ({
  ok: false,
  meta: {
    requestId,
    buildSha: "unknown",
    durationMs: 0
  },
  error: {
    code: "invalid-demo-id",
    message: "Requested entry does not exist.",
    retryable: false
  }
})

const invalidRunRequestEnvelope = (requestId: string, message: string) => ({
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
    message: "Entry execution failed.",
    retryable: true
  }
})

const encoder = new TextEncoder()

const sseEvent = (event: EvidenceEvent): Uint8Array =>
  encoder.encode(`event: evidence\ndata: ${encodeEvidenceEventJson(event)}\n\n`)

const sseHeartbeat = encoder.encode(`: heartbeat\n\n`)
const heartbeatStream: Stream.Stream<Uint8Array, never, never> = Stream.repeatValue(sseHeartbeat).pipe(
  Stream.schedule(Schedule.spaced("8 seconds"))
)

const isTerminalEvent = (event: EvidenceEvent): boolean =>
  event._tag === "StreamComplete" || event._tag === "StreamFailed"

type StreamStartup =
  | { readonly _tag: "DraftStartup"; readonly request: EntryRunRequest }
  | { readonly _tag: "ManifestStartup"; readonly manifest: StreamManifest | null; readonly runToken: string }

const draftStartup = (request: EntryRunRequest): StreamStartup => ({
  _tag: "DraftStartup",
  request
})

const manifestStartup = ({
  manifest,
  runToken
}: {
  readonly manifest: StreamManifest | null
  readonly runToken: string
}): StreamStartup => ({
  _tag: "ManifestStartup",
  manifest,
  runToken
})

const parsedStreamQuery = (startup: StreamStartup): {
  readonly _tag: "ParsedStreamQuery"
  readonly startup: StreamStartup
} => ({
  _tag: "ParsedStreamQuery",
  startup
})

const invalidStreamQuery = (message: string): {
  readonly _tag: "InvalidStreamQuery"
  readonly message: string
} => ({
  _tag: "InvalidStreamQuery",
  message
})

const streamRequestFromStartup = ({
  definitionId,
  startup
}: {
  readonly definitionId: RunnableEntryId
  readonly startup: StreamStartup
}): EntryStreamRequest =>
  Match.value(startup).pipe(
    Match.tag("DraftStartup", ({ request }) => ({
      runToken: request.runToken,
      draft: request.draft,
      plan: null
    })),
    Match.tag("ManifestStartup", ({ manifest, runToken }) => ({
      runToken,
      draft: null,
      plan: {
        id: definitionId,
        manifest
      }
    })),
    Match.exhaustive
  )

const streamResponse = ({
  id,
  requestId,
  startup
}: {
  readonly id: typeof EntryId.Type
  readonly requestId: string
  readonly startup: StreamStartup
}) =>
  Effect.gen(function*() {
    const releaseStage = yield* serverReleaseStage
    const definition = lookupForReleaseStage(id, releaseStage)

    return yield* Option.match(definition, {
      onNone: () => Effect.succeed(jsonResponse(invalidEntryEnvelope(requestId))),
      onSome: (resolvedDefinition) =>
        Effect.gen(function*() {
          const request = streamRequestFromStartup({
            definitionId: resolvedDefinition.id,
            startup
          })
          const sessionKey = yield* resolveEntryStreamRequestFingerprint(request)
          const registry = yield* EntryStreamSessionRegistry

          yield* registry.ensureSession(sessionKey)

          const executionId = yield* resolvedDefinition.workflow.executionId(request)
          const started = yield* registry.markStarted({ executionId, sessionKey })
          const workflowEngine = started
            ? Option.some(yield* WorkflowEngine.WorkflowEngine)
            : Option.none()

          const startWorkflow = Option.match(workflowEngine, {
            onNone: () => Effect.void,
            onSome: (resolvedWorkflowEngine) =>
              resolvedDefinition.workflow.execute(request).pipe(
                Effect.asVoid,
                Effect.catchAll(() => Effect.void),
                Effect.forkDaemon,
                Effect.asVoid,
                Effect.provideService(WorkflowEngine.WorkflowEngine, resolvedWorkflowEngine)
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
  | { readonly _tag: "ParsedStreamQuery"; readonly startup: StreamStartup }
  | { readonly _tag: "InvalidStreamQuery"; readonly message: string } =>
{
  if (rawUrl === null) {
    return invalidStreamQuery("Streaming runs require a run token.")
  }

  const url = new URL(rawUrl, "http://127.0.0.1")
  const rawRequest = url.searchParams.get("request")

  if (rawRequest !== null && rawRequest.trim().length > 0) {
    return Schema.decodeUnknownEither(EntryRunRequestJson)(rawRequest.trim()).pipe(
      Match.value,
      Match.tag("Right", ({ right }) => parsedStreamQuery(draftStartup(right))),
      Match.tag("Left", () => invalidStreamQuery("Stream request did not decode against the entry-run contract.")),
      Match.exhaustive
    )
  }

  const rawRunToken = url.searchParams.get("runToken")
  const rawManifest = url.searchParams.get("manifest")
  const manifest = rawManifest !== null && rawManifest.trim().length > 0
    ? Option.getOrElse(decodeStreamManifest(rawManifest.trim()), () => null)
    : null

  if (rawManifest !== null && rawManifest.trim().length > 0 && manifest === null) {
    return invalidStreamQuery("Stream manifest did not decode against the contract.")
  }

  if (rawRunToken === null || rawRunToken.trim().length === 0) {
    return invalidStreamQuery("Streaming runs require a run token.")
  }

  return parsedStreamQuery(manifestStartup({ manifest, runToken: rawRunToken.trim() }))
}

const runRoute = ({
  id,
  requestId
}: {
  readonly id: typeof EntryId.Type
  readonly requestId: string
}) =>
  HttpServerRequest.schemaBodyJson(EntryRunRequestSchema).pipe(
    Effect.flatMap((request) =>
      request.draft.entryId !== id
        ? Effect.succeed(
          jsonResponse(invalidRunRequestEnvelope(requestId, "Entry run request does not match the route id."))
        )
        : execute(request, requestId).pipe(
          Effect.flatMap((envelope) => Schema.decodeUnknown(RunEnvelope)(envelope)),
          Effect.map(jsonResponse)
        )
    )
  )

export const entryRoute = (pathname: string, requestId: string, rawUrl: string | null = null) =>
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
                ({ startup }) => streamResponse({ id: route.id, requestId, startup })
              ),
              Match.exhaustive
            )
        ),
        Match.when("run", () => runRoute({ id: route.id, requestId })),
        Match.orElse(() =>
          preload(route.id, requestId).pipe(
            Effect.flatMap((envelope) => Schema.decodeUnknown(ProgramPreviewEnvelope)(envelope)),
            Effect.map(jsonResponse)
          )
        )
      )
    ),
    Effect.catchAll((error) =>
      error instanceof InvalidEntryRoute
        ? Effect.succeed(jsonResponse(failureEnvelope(requestId)))
        : Effect.logError("theoria entry route failed").pipe(
          Effect.annotateLogs("pathname", pathname),
          Effect.annotateLogs("requestId", requestId),
          Effect.annotateLogs("error", String(error)),
          Effect.zipRight(Effect.succeed(jsonResponse(executionFailureEnvelope(requestId))))
        )
    )
  )
