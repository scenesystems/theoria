import { Activity } from "@effect/workflow"
import { Clock, Effect } from "effect"

import { EntryExecutionError } from "../../contracts/entry-error.js"
import type { RunnableEntryId } from "../../contracts/entry/id.js"
import { StreamComplete, StreamFailed } from "../../contracts/evidence/stream.js"
import { Program } from "../../contracts/presentation/program.js"
import { RunData } from "../../contracts/study/run.js"

import { RuntimeInfo } from "../config/runtime.js"
import type { ExecutionPolicy, Lane } from "./kinds/policy.js"
import { type DemoStreamPlan, EvidenceEventBatch } from "./kinds/stream-plan.js"
import type { EntryRunEnv } from "./registration.js"
import type { EntryStreamRequest } from "./stream-request.js"
import { normalizeWorkflowExecutionError, resolveWorkflowExecutionError } from "./workflow-execution-error.js"
import {
  publishWorkflowStreamEvents,
  recordWorkflowStreamEvents,
  runDataFromWorkflowStreamSession,
  type WorkflowStreamSession
} from "./workflow-stream-session.js"

export const runResolvedWorkflowStreamPlan = ({
  executionId,
  id,
  lane,
  plan,
  request,
  runLaneEffect,
  session
}: {
  readonly executionId: string
  readonly id: RunnableEntryId
  readonly lane: Lane
  readonly plan: DemoStreamPlan<EntryRunEnv, unknown>
  readonly request: EntryStreamRequest
  readonly runLaneEffect: <A, E>(
    lane: Lane,
    effect: Effect.Effect<A, E, EntryRunEnv>
  ) => Effect.Effect<A, EntryExecutionError | E, EntryRunEnv | ExecutionPolicy>
  readonly session: WorkflowStreamSession
}) =>
  Effect.gen(function*() {
    const startedAtMs = yield* Clock.currentTimeMillis
    const program = yield* Activity.make({
      error: EntryExecutionError,
      name: "prepare-program",
      success: Program,
      execute: plan.program.pipe(
        Effect.catchAll((error) =>
          normalizeWorkflowExecutionError({
            entryId: id,
            executionId,
            error,
            runToken: request.runToken
          })
        )
      )
    })

    yield* Effect.forEach(
      plan.phases,
      (phase) =>
        Activity.make({
          error: EntryExecutionError,
          name: `phase-${phase.name}`,
          success: EvidenceEventBatch,
          execute: runLaneEffect(phase.lane ?? lane, phase.events).pipe(
            Effect.catchAll((error) =>
              normalizeWorkflowExecutionError({
                entryId: id,
                executionId,
                error,
                runToken: request.runToken
              })
            )
          )
        }).pipe(
          Effect.flatMap((events) =>
            recordWorkflowStreamEvents({
              events,
              phaseName: `phase-${phase.name}`,
              session
            })
          )
        ),
      { discard: true }
    )

    const finalizedRun = yield* Activity.make({
      name: "finalize-run",
      success: RunData,
      execute: Clock.currentTimeMillis.pipe(
        Effect.flatMap((endedAtMs) =>
          runDataFromWorkflowStreamSession({
            durationMs: endedAtMs - startedAtMs,
            id,
            packageName: plan.packageName,
            program,
            session,
            summary: plan.summary
          })
        )
      )
    })
    const runtimeInfo = yield* RuntimeInfo

    yield* publishWorkflowStreamEvents({
      events: [
        StreamComplete.make({
          summary: finalizedRun.summary,
          meta: {
            requestId: request.runToken,
            buildSha: runtimeInfo.buildSha,
            durationMs: finalizedRun.durationMs
          }
        })
      ],
      phaseName: "finalize-run",
      session
    })

    return finalizedRun
  }).pipe(
    Effect.catchAll((error) =>
      resolveWorkflowExecutionError({ entryId: id, executionId, error, runToken: request.runToken }).pipe(
        Effect.flatMap((normalizedError) =>
          publishWorkflowStreamEvents({
            events: [
              StreamFailed.make({
                error: {
                  code: normalizedError.code,
                  message: normalizedError.message,
                  retryable: normalizedError.retryable
                }
              })
            ],
            phaseName: "stream-failed",
            session
          }).pipe(Effect.zipRight(Effect.fail(normalizedError)))
        )
      )
    )
  )
