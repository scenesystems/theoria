import { HttpServerResponse } from "@effect/platform"
import { WorkflowEngine } from "@effect/workflow"
import { Clock, Effect, Match, Option, Schedule, Schema, Stream } from "effect"

import type * as ParseResult from "effect/ParseResult"

import { encodeEvidenceEventJson, type EvidenceEvent, StreamFailed } from "../../contracts/evidence-stream.js"
import {
  defaultWorkflowComparisonRunPlanControls,
  makeWorkflowComparisonRunPlan,
  resolveWorkflowComparisonRunIdentity,
  WorkflowComparisonComparisonModeSchema,
  WorkflowComparisonExecutionError,
  WorkflowComparisonExecutionLaneSchema,
  WorkflowComparisonRunEnvelope,
  WorkflowComparisonRunRequest,
  type WorkflowComparisonRunRequest as WorkflowComparisonRunRequestType,
  WorkflowComparisonRuntimeProfileSchema,
  WorkflowComparisonSurfaceProfileSchema
} from "../../contracts/workflow/comparison-run.js"
import { WorkflowComparisonIdSchema } from "../../contracts/workflow/comparison.js"
import { RuntimeInfo } from "../config/runtime.js"
import { RunStreamSessionRegistry } from "../runtime/stream-session-registry.js"
import { workflowComparisonWorkflow } from "../workflow-comparison/workflow.js"

const WorkflowComparisonEndpoint = Schema.Literal("run", "stream")

const WorkflowComparisonRoute = Schema.Struct({
  endpoint: WorkflowComparisonEndpoint
})

class InvalidWorkflowComparisonRoute extends Schema.TaggedError<InvalidWorkflowComparisonRoute>()(
  "InvalidWorkflowComparisonRoute",
  {
    pathname: Schema.String
  }
) {}

const routePattern = /^\/api\/workflow-comparison\/(run|stream)$/u

const rawRoute = (pathname: string): Option.Option<{ readonly endpoint: string }> =>
  Option.fromNullable(routePattern.exec(pathname)).pipe(
    Option.flatMap((matches) => Option.fromNullable(matches[1]).pipe(Option.map((endpoint) => ({ endpoint }))))
  )

const decodeRoute = (pathname: string): Effect.Effect<
  typeof WorkflowComparisonRoute.Type,
  InvalidWorkflowComparisonRoute | ParseResult.ParseError
> =>
  Option.match(rawRoute(pathname), {
    onNone: () => Effect.fail(new InvalidWorkflowComparisonRoute({ pathname })),
    onSome: (route) => Schema.decodeUnknown(WorkflowComparisonRoute)(route)
  })

const statusFromEnvelope = (envelope: { readonly ok: boolean; readonly error?: { readonly code: string } }): number =>
  envelope.ok ? 200 : envelope.error?.code === "invalid-query" ? 400 : 500

const jsonResponse = <A extends { readonly ok: boolean; readonly error?: { readonly code: string } }>(body: A) =>
  HttpServerResponse.json(body, {
    status: statusFromEnvelope(body),
    headers: {
      "cache-control": "no-store"
    }
  })

const invalidQueryError = (message: string) =>
  new WorkflowComparisonExecutionError({
    code: "invalid-query",
    message,
    retryable: false
  })

const failureResponse = (requestId: string, error: WorkflowComparisonExecutionError) =>
  Effect.gen(function*() {
    const runtimeInfo = yield* RuntimeInfo
    const body = yield* Schema.encode(WorkflowComparisonRunEnvelope)({
      ok: false,
      meta: {
        requestId,
        buildSha: runtimeInfo.buildSha,
        durationMs: 0
      },
      error: {
        code: error.code,
        message: error.message,
        retryable: error.retryable
      }
    }).pipe(Effect.orDie)

    return yield* jsonResponse(body).pipe(Effect.orDie)
  })

const encoder = new TextEncoder()
const sseHeartbeat = encoder.encode(`: heartbeat\n\n`)
const heartbeatStream = Stream.repeat(Stream.make(sseHeartbeat), Schedule.spaced("8 seconds"))

const sseEvent = (event: EvidenceEvent): Uint8Array =>
  encoder.encode(`event: evidence\ndata: ${encodeEvidenceEventJson(event)}\n\n`)

const isTerminalEvent = (event: EvidenceEvent): boolean =>
  event._tag === "StreamComplete" || event._tag === "StreamFailed"

const sseFailureResponse = (error: WorkflowComparisonExecutionError) =>
  HttpServerResponse.stream(
    Stream.make(
      sseEvent(
        new StreamFailed({
          error: {
            code: error.code,
            message: error.message,
            retryable: error.retryable
          }
        })
      )
    ),
    {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive"
      }
    }
  )

const decodeBooleanQuery = ({
  defaultValue,
  field,
  rawValue
}: {
  readonly defaultValue: boolean
  readonly field: string
  readonly rawValue: string | null
}): Effect.Effect<boolean, WorkflowComparisonExecutionError, never> =>
  rawValue === null
    ? Effect.succeed(defaultValue)
    : rawValue === "true"
    ? Effect.succeed(true)
    : rawValue === "false"
    ? Effect.succeed(false)
    : Effect.fail(invalidQueryError(`${field} must be true or false.`))

const decodeSchemaQuery = <A, I>({
  defaultValue,
  field,
  rawValue,
  schema
}: {
  readonly defaultValue: A
  readonly field: string
  readonly rawValue: string | null
  readonly schema: Schema.Schema<A, I>
}): Effect.Effect<A, WorkflowComparisonExecutionError, never> =>
  rawValue === null
    ? Effect.succeed(defaultValue)
    : Schema.decodeUnknown(schema)(rawValue).pipe(
      Effect.mapError(() => invalidQueryError(`${field} did not decode against the contract.`))
    )

const parseRunRequest = (
  rawUrl: string | null,
  requestId: string,
  requireRunToken: boolean
): Effect.Effect<WorkflowComparisonRunRequestType, WorkflowComparisonExecutionError, never> =>
  Effect.try({
    try: () => new URL(rawUrl ?? "http://127.0.0.1", "http://127.0.0.1"),
    catch: () => invalidQueryError("Workflow comparison request URL is invalid.")
  }).pipe(
    Effect.flatMap((url) => {
      const comparisonId = url.searchParams.get("comparisonId")
      const runToken = requireRunToken
        ? url.searchParams.get("runToken")
        : url.searchParams.get("runToken") ?? requestId

      return comparisonId === null || comparisonId.trim().length === 0
        ? Effect.fail(invalidQueryError("Workflow comparison runs require a comparisonId."))
        : runToken === null || runToken.trim().length === 0
        ? Effect.fail(invalidQueryError("Workflow comparison streams require a runToken."))
        : Effect.all({
          comparisonId: Schema.decodeUnknown(WorkflowComparisonIdSchema)(comparisonId.trim()).pipe(
            Effect.mapError(() => invalidQueryError("Workflow comparison query did not decode against the contract."))
          ),
          comparisonMode: decodeSchemaQuery({
            defaultValue: defaultWorkflowComparisonRunPlanControls.comparisonMode,
            field: "comparisonMode",
            rawValue: url.searchParams.get("comparisonMode"),
            schema: WorkflowComparisonComparisonModeSchema
          }),
          lane: decodeSchemaQuery({
            defaultValue: defaultWorkflowComparisonRunPlanControls.lane,
            field: "lane",
            rawValue: url.searchParams.get("lane"),
            schema: WorkflowComparisonExecutionLaneSchema
          }),
          optimize: decodeBooleanQuery({
            defaultValue: defaultWorkflowComparisonRunPlanControls.optimize,
            field: "optimize",
            rawValue: url.searchParams.get("optimize")
          }),
          runtimeProfile: decodeSchemaQuery({
            defaultValue: defaultWorkflowComparisonRunPlanControls.runtimeProfile,
            field: "runtimeProfile",
            rawValue: url.searchParams.get("runtimeProfile"),
            schema: WorkflowComparisonRuntimeProfileSchema
          }),
          surfaceProfile: decodeSchemaQuery({
            defaultValue: defaultWorkflowComparisonRunPlanControls.surfaceProfile,
            field: "surfaceProfile",
            rawValue: url.searchParams.get("surfaceProfile"),
            schema: WorkflowComparisonSurfaceProfileSchema
          })
        }).pipe(
          Effect.flatMap(({ comparisonId, comparisonMode, lane, optimize, runtimeProfile, surfaceProfile }) =>
            !optimize && comparisonMode === "search-winner"
              ? Effect.fail(
                invalidQueryError(
                  "Workflow comparison comparisonMode=search-winner requires optimize=true."
                )
              )
              : Schema.decodeUnknown(WorkflowComparisonRunRequest)({
                runToken: runToken.trim(),
                plan: makeWorkflowComparisonRunPlan({
                  comparisonId,
                  comparisonMode,
                  lane,
                  optimize,
                  runtimeProfile,
                  surfaceProfile
                })
              }).pipe(
                Effect.mapError(() =>
                  invalidQueryError("Workflow comparison query did not decode against the contract.")
                )
              )
          )
        )
    })
  )

const streamResponse = (request: WorkflowComparisonRunRequestType) =>
  Effect.gen(function*() {
    const identity = yield* resolveWorkflowComparisonRunIdentity(request)
    const sessionKey = identity.requestFingerprint
    const registry = yield* RunStreamSessionRegistry

    yield* registry.ensureSession(sessionKey)

    const executionId = yield* workflowComparisonWorkflow.executionId(request)
    const started = yield* registry.markStarted({ executionId, sessionKey })
    const workflowEngine = started ? Option.some(yield* WorkflowEngine.WorkflowEngine) : Option.none()
    const startWorkflow = Option.match(workflowEngine, {
      onNone: () => Effect.void,
      onSome: (engine) =>
        workflowComparisonWorkflow.execute(request).pipe(
          Effect.asVoid,
          Effect.catchAll(() => Effect.void),
          Effect.forkDaemon,
          Effect.asVoid,
          Effect.provideService(WorkflowEngine.WorkflowEngine, engine)
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
        connection: "keep-alive"
      }
    })
  })

export const workflowComparisonRoute = (pathname: string, requestId: string, rawUrl: string | null = null) =>
  decodeRoute(pathname).pipe(
    Effect.flatMap((route) =>
      Match.value(route.endpoint).pipe(
        Match.when("run", () =>
          Effect.gen(function*() {
            const startedAtMs = yield* Clock.currentTimeMillis
            const runtimeInfo = yield* RuntimeInfo
            const request = yield* parseRunRequest(rawUrl, requestId, false)
            const success = yield* workflowComparisonWorkflow.execute(request)
            const endedAtMs = yield* Clock.currentTimeMillis
            const body = yield* Schema.encode(WorkflowComparisonRunEnvelope)({
              ok: true,
              meta: {
                requestId,
                buildSha: runtimeInfo.buildSha,
                durationMs: endedAtMs - startedAtMs
              },
              data: success
            }).pipe(Effect.orDie)

            return yield* jsonResponse(body).pipe(Effect.orDie)
          }).pipe(
            Effect.catchAll((error) => failureResponse(requestId, error))
          )),
        Match.when("stream", () =>
          parseRunRequest(rawUrl, requestId, true).pipe(
            Effect.flatMap(streamResponse),
            Effect.catchAll((error) => Effect.succeed(sseFailureResponse(error)))
          )),
        Match.exhaustive
      )
    ),
    Effect.catchAll(() =>
      failureResponse(
        requestId,
        invalidQueryError(
          "Workflow comparison route must be /api/workflow-comparison/run or /api/workflow-comparison/stream."
        )
      )
    )
  )
