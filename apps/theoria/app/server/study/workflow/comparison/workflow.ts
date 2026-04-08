import { Activity, Workflow } from "@effect/workflow"
import { Clock, Effect } from "effect"

import { DemoExecutionError } from "../../../../contracts/demo-error.js"
import { StreamComplete, StreamFailed } from "../../../../contracts/evidence/stream.js"
import { Program } from "../../../../contracts/presentation/program.js"
import { RunData } from "../../../../contracts/study/run.js"
import { WorkflowComparisonExecutionError } from "../../../../contracts/study/workflow/comparison/run.js"
import { RuntimeInfo } from "../../../config/runtime.js"
import {
  encodeEntryStreamRequestJson,
  type EntryStreamRequest,
  EntryStreamRequest as EntryStreamRequestSchema
} from "../../../kernel/stream-request.js"
import { defaultWorkflowComparisonId } from "./catalog.js"
import { comparisonSummaryEvents, overviewEventsForComparison, runDataFromStore } from "./evidence.js"
import { normalizeWorkflowComparisonExecutionError } from "./execution-error.js"
import { FrozenWorkflowComparisonRunSchema } from "./frozen.js"
import { programForWorkflowComparison } from "./program.js"
import { workflowEntryDraftForRequest } from "./request.js"
import {
  workflowComparisonSelectedKnobsForRecord,
  workflowEntrySelectionUsesOptimization,
  workflowEntrySelectionUsesSearchWinner
} from "./run-controls.js"
import {
  appendWorkflowComparisonEvents,
  makeWorkflowComparisonRunSession,
  workflowComparisonStoreForSession
} from "./run-session.js"
import { optimizationStudyCompletedEvents } from "./search-study-evidence.js"
import { optimizationStudyStartedEvents } from "./search-study-progress.js"
import { WorkflowComparisonSearchStudyOutcomeSchema } from "./search-study-schema.js"
import { workflowComparisonSearchDimensions } from "./search-study-space.js"
import { runWorkflowComparisonSearchStudy } from "./search-study.js"
import { comparisonForRequest, executeVariant } from "./session.js"

export const preloadProgram = comparisonForRequest(defaultWorkflowComparisonId).pipe(
  Effect.map(programForWorkflowComparison)
)

export const workflowEntryWorkflow = Workflow.make({
  name: "theoria-entry-workflow-run",
  payload: EntryStreamRequestSchema,
  success: RunData,
  error: DemoExecutionError,
  idempotencyKey: encodeEntryStreamRequestJson
})

const executeWorkflowComparisonRun = (request: EntryStreamRequest) =>
  Effect.gen(function*() {
    const draft = yield* workflowEntryDraftForRequest(request)
    const session = yield* makeWorkflowComparisonRunSession({ draft, runToken: request.runToken })

    return yield* Effect.gen(function*() {
      const comparison = yield* Activity.make({
        error: WorkflowComparisonExecutionError,
        name: "freeze-comparison",
        success: FrozenWorkflowComparisonRunSchema,
        execute: comparisonForRequest(draft.seedId)
      })
      const program = yield* Activity.make({
        error: WorkflowComparisonExecutionError,
        name: "prepare-program",
        success: Program,
        execute: Effect.succeed(programForWorkflowComparison(comparison))
      })
      const startedAtMs = yield* Clock.currentTimeMillis

      yield* appendWorkflowComparisonEvents({
        events: overviewEventsForComparison(comparison),
        phaseName: "overview",
        session
      })

      const baselineSelectedKnobs = workflowComparisonSelectedKnobsForRecord({
        plan: draft,
        record: comparison.baseline.record
      })
      const authoredOptimizedSelectedKnobs = workflowComparisonSelectedKnobsForRecord({
        plan: draft,
        record: comparison.optimized.record
      })

      const baseline = yield* executeVariant({
        comparison,
        lane: draft.controls.lane,
        phasePrefix: "baseline",
        selectedKnobs: baselineSelectedKnobs,
        session,
        variant: "baseline"
      })

      const searchStudy = yield* (
        workflowEntrySelectionUsesOptimization(draft)
          ? Effect.gen(function*() {
            const searchDimensions = yield* workflowComparisonSearchDimensions(comparison, draft)
            const searchTrialBudget = searchDimensions.reduce(
              (product, dimension) => product * dimension.choices.length,
              1
            )

            yield* appendWorkflowComparisonEvents({
              events: optimizationStudyStartedEvents({ trialBudget: searchTrialBudget }),
              phaseName: "optimization-study-start",
              session
            })

            const outcome = yield* Activity.make({
              error: WorkflowComparisonExecutionError,
              name: "optimize-graph-manifest",
              success: WorkflowComparisonSearchStudyOutcomeSchema,
              execute: runWorkflowComparisonSearchStudy({
                comparison,
                lane: draft.controls.lane,
                plan: draft,
                publishProgress: (events) =>
                  appendWorkflowComparisonEvents({
                    events,
                    phaseName: "optimization-study-progress",
                    session
                  })
              })
            })

            yield* appendWorkflowComparisonEvents({
              events: optimizationStudyCompletedEvents({
                comparison,
                dimensions: searchDimensions,
                outcome
              }),
              phaseName: "optimization-study-complete",
              session
            })

            return outcome
          })
          : Effect.succeed(null)
      )

      const optimized = yield* executeVariant({
        comparison,
        lane: draft.controls.lane,
        phasePrefix: "optimized",
        profile: comparison.optimized.profile,
        record: searchStudy !== null && workflowEntrySelectionUsesSearchWinner(draft)
          ? searchStudy.winner.execution.record
          : comparison.optimized.record,
        selectedKnobs: searchStudy !== null && workflowEntrySelectionUsesSearchWinner(draft)
          ? searchStudy.winner.selection
          : authoredOptimizedSelectedKnobs,
        session,
        variant: "optimized"
      })

      yield* appendWorkflowComparisonEvents({
        events: comparisonSummaryEvents(baseline, optimized),
        phaseName: "comparison-summary",
        session
      })

      const runData = yield* Activity.make({
        error: WorkflowComparisonExecutionError,
        name: "finalize-run",
        success: RunData,
        execute: Clock.currentTimeMillis.pipe(
          Effect.flatMap((endedAtMs) =>
            workflowComparisonStoreForSession(session).pipe(
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

      yield* appendWorkflowComparisonEvents({
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
        session
      })

      return runData
    }).pipe(
      Effect.catchAll((cause) => {
        const error = normalizeWorkflowComparisonExecutionError(cause)

        return appendWorkflowComparisonEvents({
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
          session
        }).pipe(Effect.zipRight(Effect.fail(error)))
      })
    )
  })

export const WorkflowEntryWorkflowLive = workflowEntryWorkflow.toLayer(
  Effect.fnUntraced(function*(request, _executionId) {
    return yield* executeWorkflowComparisonRun(request)
  })
)

export const workflowEntryWorkflowRegistration = {
  workflow: workflowEntryWorkflow,
  workflowLive: WorkflowEntryWorkflowLive
}
