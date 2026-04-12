import { WorkflowEngine } from "@effect/workflow"
import { Effect, Match, Option, Stream } from "effect"

import type { EntryRunRequest } from "../../contracts/entry/registry.js"
import type { EvidenceEvent } from "../../contracts/evidence/stream.js"
import { serverReleaseStage } from "../config/release-stage.js"
import { RunStreamSessionRegistry } from "../kernel/kinds/stream-session-registry.js"
import { lookupForReleaseStage } from "../kernel/registry.js"
import { resolveEntryStreamRequestFingerprint } from "../kernel/stream-request.js"

import { invalidEntryEnvelope, invalidQueryEnvelope, jsonResponse, streamEvidenceResponse } from "./entry-response.js"
import { parseEntryStreamQuery, streamRequestFromStartup, type StreamStartup } from "./entry-stream-startup.js"

const isTerminalEvent = (event: EvidenceEvent): boolean =>
  event._tag === "StreamComplete" || event._tag === "StreamFailed"

const streamResponse = ({
  id,
  requestId,
  startup
}: {
  readonly id: EntryRunRequest["draft"]["entryId"]
  readonly requestId: string
  readonly startup: StreamStartup
}) =>
  Effect.gen(function*() {
    const releaseStage = yield* serverReleaseStage
    const definition = lookupForReleaseStage(id, releaseStage)

    return yield* Option.match(definition, {
      onNone: () => jsonResponse(invalidEntryEnvelope(requestId)),
      onSome: (resolvedDefinition) =>
        Effect.gen(function*() {
          const request = streamRequestFromStartup({
            definitionId: resolvedDefinition.id,
            startup
          })
          const sessionKey = yield* resolveEntryStreamRequestFingerprint(request)
          const registry = yield* RunStreamSessionRegistry

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
          ).pipe(Stream.takeUntil(isTerminalEvent))

          return streamEvidenceResponse(dataStream)
        })
    })
  })

export const entryStreamRoute = ({
  id,
  rawUrl,
  requestId
}: {
  readonly id: EntryRunRequest["draft"]["entryId"]
  readonly rawUrl: string | null
  readonly requestId: string
}) =>
  Match.value(parseEntryStreamQuery(rawUrl)).pipe(
    Match.tag(
      "InvalidStreamQuery",
      ({ message }) => jsonResponse(invalidQueryEnvelope(requestId, message))
    ),
    Match.tag("ParsedStreamQuery", ({ startup }) => streamResponse({ id, requestId, startup })),
    Match.exhaustive
  )
