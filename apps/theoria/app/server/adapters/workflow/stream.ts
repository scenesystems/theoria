import { Effect, Option, Ref, Schema } from "effect"

import { workflowEntryDescriptor } from "../../../contracts/entry/descriptors/workflow.js"
import { EntryRunIdentity } from "../../../contracts/entry/routing.js"
import { type StreamManifest, WorkflowManifest } from "../../../contracts/evidence/manifest.js"
import type { EvidenceEvent } from "../../../contracts/evidence/stream.js"
import {
  WorkflowStudyExecutionError,
  type WorkflowVariantExecution
} from "../../../contracts/study/workflow/execution.js"
import { WorkflowScenarioManifest } from "../../../contracts/study/workflow/manifest.js"
import { WorkflowEntrySelection } from "../../../contracts/study/workflow/selection.js"
import type { Lane } from "../../kernel/kinds/policy.js"
import type { DemoStreamPhase } from "../../kernel/kinds/stream-plan.js"
import type { EntryRunEnv } from "../../kernel/registration.js"
import { runWorkflowVariantPhase } from "../../study/workflow/evaluation/variant-phase.js"
import { workflowDeltaEvents, workflowOverviewEvents } from "../../study/workflow/evidence/events.js"
import { workflowSearchStartedEvents } from "../../study/workflow/evidence/search-progress.js"
import { workflowSearchCompletedEvents } from "../../study/workflow/evidence/search-summary.js"
import { frozenWorkflowForRequest } from "../../study/workflow/frozen.js"
import { preloadWorkflowProgram } from "../../study/workflow/preload.js"
import { programForWorkflow } from "../../study/workflow/program.js"
import { trialBudgetForDimensions, workflowSearchDimensions } from "../../study/workflow/search/dimensions.js"
import type { WorkflowSearchStudyResult } from "../../study/workflow/search/schema.js"
import {
  baselineWorkflowVariantSelection,
  optimizedWorkflowVariantSelection
} from "../../study/workflow/search/selection.js"
import { runWorkflowSearchStudy } from "../../study/workflow/search/study.js"

const workflowRunIdentity = EntryRunIdentity.project(workflowEntryDescriptor)
const packageName = workflowRunIdentity.packageName

export const preloadProgram = preloadWorkflowProgram(WorkflowScenarioManifest.defaults().id)

const runSummary =
  "Freeze one workflow seed, execute baseline and optimized variants on the server, and author search-study evidence on one kernel-owned ledger."

const executionError = (message: string) =>
  new WorkflowStudyExecutionError({
    code: "execution-failed",
    message,
    retryable: false
  })

const workflowSelectionFromManifest = (manifest: StreamManifest | null) =>
  manifest !== null && Schema.is(WorkflowManifest)(manifest)
    ? WorkflowEntrySelection.validate(
      WorkflowEntrySelection.make({
        seedId: manifest.seedId,
        controls: manifest.controls
      })
    )
    : Effect.fail(executionError("Workflow stream planning requires a workflow manifest."))

const policyLaneForExecutionLane = (lane: WorkflowEntrySelection["controls"]["lane"]): Lane =>
  lane === "deterministic-fallback" ? "local" : "provider"

const recordedExecution = (
  label: string,
  value: Option.Option<WorkflowVariantExecution>
) =>
  Option.match(value, {
    onNone: () => Effect.fail(executionError(`Workflow ${label} phase did not retain its execution result.`)),
    onSome: Effect.succeed
  })

const staticPhase = (name: string, events: ReadonlyArray<EvidenceEvent>): DemoStreamPhase<EntryRunEnv, never> => ({
  name,
  events: Effect.succeed(events)
})

export const streamPlan = (manifest: StreamManifest | null) =>
  Effect.gen(function*() {
    const selection = yield* workflowSelectionFromManifest(manifest)
    const workflowRun = yield* frozenWorkflowForRequest(selection.seedId)
    const baselineExecutionRef = yield* Ref.make<Option.Option<WorkflowVariantExecution>>(Option.none())
    const optimizedExecutionRef = yield* Ref.make<Option.Option<WorkflowVariantExecution>>(Option.none())
    const searchStudyRef = yield* Ref.make<Option.Option<WorkflowSearchStudyResult>>(Option.none())
    const executionLane = policyLaneForExecutionLane(selection.controls.lane)
    const baselineSelection = baselineWorkflowVariantSelection({ workflowRun, plan: selection })

    const baselinePhase: DemoStreamPhase<EntryRunEnv, WorkflowStudyExecutionError> = {
      name: "baseline",
      lane: executionLane,
      events: runWorkflowVariantPhase({
        workflowRun,
        lane: selection.controls.lane,
        selection: baselineSelection
      }).pipe(
        Effect.tap(({ execution }) => Ref.set(baselineExecutionRef, Option.some(execution))),
        Effect.map(({ events }) => events)
      )
    }

    const optimizationPhases: ReadonlyArray<DemoStreamPhase<EntryRunEnv, WorkflowStudyExecutionError>> =
      selection.controls.optimize
        ? [{
          name: "optimization-study",
          lane: executionLane,
          events: Effect.gen(function*() {
            const dimensions = yield* workflowSearchDimensions(workflowRun, selection)
            const progressEventsRef = yield* Ref.make<ReadonlyArray<EvidenceEvent>>(
              workflowSearchStartedEvents({ trialBudget: trialBudgetForDimensions(dimensions) })
            )
            const outcome = yield* runWorkflowSearchStudy({
              workflowRun,
              lane: selection.controls.lane,
              plan: selection,
              publishProgress: (events) => Ref.update(progressEventsRef, (current) => [...current, ...events])
            })

            yield* Ref.set(searchStudyRef, Option.some({ dimensions, outcome }))

            return [
              ...(yield* Ref.get(progressEventsRef)),
              ...workflowSearchCompletedEvents({ workflowRun, dimensions, outcome })
            ]
          })
        }]
        : []

    const optimizedPhase: DemoStreamPhase<EntryRunEnv, WorkflowStudyExecutionError> = {
      name: "optimized",
      lane: executionLane,
      events: Ref.get(searchStudyRef).pipe(
        Effect.flatMap((searchStudy) => {
          const optimizedSelection = optimizedWorkflowVariantSelection({
            workflowRun,
            plan: selection,
            searchStudy
          })

          return runWorkflowVariantPhase({
            workflowRun,
            lane: selection.controls.lane,
            selection: optimizedSelection
          }).pipe(
            Effect.tap(({ execution }) => Ref.set(optimizedExecutionRef, Option.some(execution))),
            Effect.map(({ events }) => events)
          )
        })
      )
    }

    const workflowDeltaPhase: DemoStreamPhase<EntryRunEnv, WorkflowStudyExecutionError> = {
      name: "workflow-delta",
      events: Effect.gen(function*() {
        const baseline = yield* recordedExecution("baseline", yield* Ref.get(baselineExecutionRef))
        const optimized = yield* recordedExecution("optimized", yield* Ref.get(optimizedExecutionRef))

        return workflowDeltaEvents(baseline, optimized)
      })
    }

    return {
      packageName,
      program: Effect.succeed(programForWorkflow(workflowRun)),
      summary: runSummary,
      phases: [
        staticPhase("overview", workflowOverviewEvents(workflowRun)),
        baselinePhase,
        ...optimizationPhases,
        optimizedPhase,
        workflowDeltaPhase
      ]
    }
  })
