import type { FileSystem, Path } from "@effect/platform"
import { Activity } from "@effect/workflow"
import type { Scope } from "effect"
import { Clock, Effect } from "effect"

import { DemoExecutionError } from "../../contracts/demo-error.js"
import type { RunnableEntryId } from "../../contracts/entry/id.js"
import type { StreamManifest } from "../../contracts/evidence/manifest.js"
import { StreamComplete, StreamFailed } from "../../contracts/evidence/stream.js"
import { Program } from "../../contracts/presentation/program.js"
import { RunData } from "../../contracts/study/run.js"

import type { DspProviderRuntime } from "../capability/effect-dsp.js"
import { RuntimeInfo } from "../config/runtime.js"
import type { ExecutionPolicy, Lane } from "./kinds/policy.js"
import { type DemoStreamPlan, EvidenceEventBatch } from "./kinds/stream-plan.js"
import { type EntryStreamRequest, manifestForRequest, resolveEntryStreamRequestFingerprint } from "./stream-request.js"
import { normalizeWorkflowExecutionError, resolveWorkflowExecutionError } from "./workflow-execution-error.js"
import {
  makeWorkflowStreamSession,
  publishWorkflowStreamEvents,
  recordWorkflowStreamEvents,
  runDataFromWorkflowStreamSession
} from "./workflow-stream-session.js"

type ProgramSourceEnv = FileSystem.FileSystem | Path.Path
type DemoRunEnv = DspProviderRuntime | ProgramSourceEnv
type ResolvedDemoStreamPlan = (
  manifest: StreamManifest | null
) => Effect.Effect<DemoStreamPlan<DemoRunEnv, unknown>, unknown, DemoRunEnv | Scope.Scope>

export const runStreamPlanWorkflow = ({
  executionId,
  id,
  lane,
  request,
  runLaneEffect,
  streamPlan
}: {
  readonly executionId: string
  readonly id: RunnableEntryId
  readonly lane: Lane
  readonly request: EntryStreamRequest
  readonly runLaneEffect: <A, E>(
    lane: Lane,
    effect: Effect.Effect<A, E, DemoRunEnv>
  ) => Effect.Effect<A, DemoExecutionError | E, DemoRunEnv | ExecutionPolicy>
  readonly streamPlan: ResolvedDemoStreamPlan
}) =>
  Effect.gen(function*() {
    const sessionKey = yield* resolveEntryStreamRequestFingerprint(request)
    const session = yield* makeWorkflowStreamSession(sessionKey)
    const manifest = manifestForRequest(request)

    return yield* Effect.gen(function*() {
      const plan = yield* streamPlan(manifest).pipe(
        Effect.catchAll((error) =>
          normalizeWorkflowExecutionError({
            demoId: id,
            executionId,
            error,
            runToken: request.runToken
          })
        )
      )
      const startedAtMs = yield* Clock.currentTimeMillis
      const program = yield* Activity.make({
        error: DemoExecutionError,
        name: "prepare-program",
        success: Program,
        execute: plan.program.pipe(
          Effect.catchAll((error) =>
            normalizeWorkflowExecutionError({
              demoId: id,
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
            error: DemoExecutionError,
            name: `phase-${phase.name}`,
            success: EvidenceEventBatch,
            execute: runLaneEffect(lane, phase.events).pipe(
              Effect.catchAll((error) =>
                normalizeWorkflowExecutionError({
                  demoId: id,
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
          new StreamComplete({
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
        resolveWorkflowExecutionError({ demoId: id, executionId, error, runToken: request.runToken }).pipe(
          Effect.flatMap((normalizedError) =>
            publishWorkflowStreamEvents({
              events: [
                new StreamFailed({
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
  })
