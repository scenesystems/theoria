import type { WorkflowEngine } from "@effect/workflow"
import { Activity, Workflow } from "@effect/workflow"
import { Clock, Effect, Ref, Schema } from "effect"

import { emptyEvidenceStoreState } from "../../contracts/evidence-store.js"
import { StreamComplete, StreamFailed } from "../../contracts/evidence-stream.js"
import { DurableFingerprint } from "../../contracts/fingerprint.js"
import { Program } from "../../contracts/presentation.js"
import { RunData } from "../../contracts/run.js"
import {
  encodeWorkflowComparisonRunRequestJson,
  resolveWorkflowComparisonRunIdentity,
  WorkflowComparisonExecutionError,
  WorkflowComparisonRunRequest,
  type WorkflowComparisonRunRequest as WorkflowComparisonRunRequestType,
  WorkflowComparisonRunSuccess,
  type WorkflowComparisonRunSuccess as WorkflowComparisonRunSuccessType
} from "../../contracts/workflow/comparison-run.js"
import { RuntimeInfo } from "../config/runtime.js"
import type { RunStreamSessionRegistry } from "../runtime/stream-session-registry.js"
import { comparisonSummaryEvents, overviewEventsForComparison, runDataFromStore } from "./evidence.js"
import { frozenWorkflowComparisonFingerprint, FrozenWorkflowComparisonRunSchema } from "./frozen.js"
import { programForWorkflowComparison } from "./program.js"
import {
  optimizationStudyEvidenceEvents,
  runWorkflowComparisonSearchStudy,
  workflowComparisonSearchDimensions,
  WorkflowComparisonSearchStudyOutcomeSchema
} from "./search-study.js"
import { appendEvents, comparisonForRequest, executeVariant } from "./session.js"

const makeWorkflowComparisonRunSuccess = Schema.decodeUnknownSync(WorkflowComparisonRunSuccess)

const normalizeExecutionError = (error: unknown): WorkflowComparisonExecutionError =>
  error instanceof WorkflowComparisonExecutionError
    ? error
    : new WorkflowComparisonExecutionError({
      code: "execution-failed",
      message: String(error),
      retryable: false
    })

export const workflowComparisonWorkflow = Workflow.make({
  name: "theoria-workflow-comparison-run",
  payload: WorkflowComparisonRunRequest,
  success: WorkflowComparisonRunSuccess,
  error: WorkflowComparisonExecutionError,
  idempotencyKey: encodeWorkflowComparisonRunRequestJson
})

type WorkflowComparisonWorkflowRequirements =
  | RuntimeInfo
  | RunStreamSessionRegistry
  | WorkflowEngine.WorkflowEngine
  | WorkflowEngine.WorkflowInstance

const executeWorkflowComparisonRun = (
  request: WorkflowComparisonRunRequestType
): Effect.Effect<
  WorkflowComparisonRunSuccessType,
  WorkflowComparisonExecutionError,
  WorkflowComparisonWorkflowRequirements
> =>
  Effect.gen(function*() {
    const identity = yield* resolveWorkflowComparisonRunIdentity(request)
    const sessionKey = identity.requestFingerprint
    const batchIndexRef = yield* Ref.make(0)
    const storeRef = yield* Ref.make(emptyEvidenceStoreState)

    return yield* Effect.gen(function*() {
      const comparison = yield* Activity.make({
        error: WorkflowComparisonExecutionError,
        name: "freeze-comparison",
        success: FrozenWorkflowComparisonRunSchema,
        execute: comparisonForRequest(request.plan.comparisonId)
      })
      const comparisonFingerprint = yield* Activity.make({
        error: WorkflowComparisonExecutionError,
        name: "fingerprint-comparison",
        success: DurableFingerprint,
        execute: frozenWorkflowComparisonFingerprint(comparison)
      })
      const program = yield* Activity.make({
        error: WorkflowComparisonExecutionError,
        name: "prepare-program",
        success: Program,
        execute: Effect.succeed(programForWorkflowComparison(comparison))
      })
      const startedAtMs = yield* Clock.currentTimeMillis

      yield* appendEvents({
        batchIndexRef,
        events: overviewEventsForComparison(comparison),
        phaseName: "overview",
        sessionKey,
        storeRef
      })

      const baseline = yield* executeVariant({
        batchIndexRef,
        comparison,
        lane: request.plan.lane,
        phasePrefix: "baseline",
        sessionKey,
        storeRef,
        variant: "baseline"
      })

      const searchStudy = yield* Activity.make({
        error: WorkflowComparisonExecutionError,
        name: "optimize-graph-manifest",
        success: WorkflowComparisonSearchStudyOutcomeSchema,
        execute: runWorkflowComparisonSearchStudy({
          comparison,
          lane: request.plan.lane
        })
      })
      const searchDimensions = yield* workflowComparisonSearchDimensions(comparison)

      yield* appendEvents({
        batchIndexRef,
        events: optimizationStudyEvidenceEvents({
          comparison,
          dimensions: searchDimensions,
          outcome: searchStudy
        }),
        phaseName: "optimization-study",
        sessionKey,
        storeRef
      })

      const optimized = yield* executeVariant({
        batchIndexRef,
        comparison,
        lane: request.plan.lane,
        phasePrefix: "optimized",
        profile: comparison.optimized.profile,
        record: searchStudy.winner.execution.record,
        selectedKnobs: searchStudy.winner.selection,
        sessionKey,
        storeRef,
        variant: "optimized"
      })

      yield* appendEvents({
        batchIndexRef,
        events: comparisonSummaryEvents(baseline, optimized),
        phaseName: "comparison-summary",
        sessionKey,
        storeRef
      })

      const runData = yield* Activity.make({
        error: WorkflowComparisonExecutionError,
        name: "finalize-run",
        success: RunData,
        execute: Clock.currentTimeMillis.pipe(
          Effect.flatMap((endedAtMs) =>
            Ref.get(storeRef).pipe(
              Effect.map((store) =>
                runDataFromStore({
                  comparison,
                  durationMs: endedAtMs - startedAtMs,
                  program,
                  store
                })
              )
            )
          )
        )
      })
      const runtimeInfo = yield* RuntimeInfo

      yield* appendEvents({
        batchIndexRef,
        events: [
          new StreamComplete({
            summary: runData.summary,
            meta: {
              requestId: request.runToken,
              buildSha: runtimeInfo.buildSha,
              durationMs: runData.durationMs
            }
          })
        ],
        phaseName: "stream-complete",
        sessionKey,
        storeRef
      })

      return makeWorkflowComparisonRunSuccess({
        identity,
        comparisonFingerprint,
        workflowKind: comparison.workflowKind,
        baseline,
        optimized,
        runData
      })
    }).pipe(
      Effect.catchAll((cause) => {
        const error = normalizeExecutionError(cause)

        return appendEvents({
          batchIndexRef,
          events: [
            new StreamFailed({
              error: {
                code: error.code,
                message: error.message,
                retryable: error.retryable
              }
            })
          ],
          phaseName: "stream-failed",
          sessionKey,
          storeRef
        }).pipe(Effect.zipRight(Effect.fail(error)))
      })
    )
  })

export const WorkflowComparisonWorkflowLive = workflowComparisonWorkflow.toLayer(
  Effect.fnUntraced(function*(request, _executionId) {
    return yield* executeWorkflowComparisonRun(request)
  })
)
