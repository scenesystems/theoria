import { Effect, Option, Ref, Schema } from "effect"

import { workflowEntryId } from "../../../contracts/entry/id.js"
import { EntryRunIdentity } from "../../../contracts/entry/routing.js"
import type { EvidenceEvent } from "../../../contracts/evidence/stream.js"
import { type StudyManifest, WorkflowManifest } from "../../../contracts/study/manifest.js"
import { workflowStudyDescriptor } from "../../../contracts/study/workflow/descriptor.js"
import {
  WorkflowStudyExecutionError,
  type WorkflowVariantExecution
} from "../../../contracts/study/workflow/execution.js"
import type { WorkflowStudyInput } from "../../../contracts/study/workflow/input.js"
import { WorkflowEntrySelection } from "../../../contracts/study/workflow/selection.js"
import type { Lane } from "../../kernel/kinds/policy.js"
import type { DemoStreamPhase } from "../../kernel/kinds/stream-plan.js"
import type { StudyRunEnv } from "../../kernel/registration.js"
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

const workflowRunIdentity = EntryRunIdentity.fromEntryId(workflowEntryId)
const packageName = workflowRunIdentity.packageName

export const preloadProgram = preloadWorkflowProgram(workflowStudyDescriptor.defaultSeedId())

const runSummary =
  "Freeze one workflow seed, execute baseline and optimized variants on the server, and author search-study evidence on one kernel-owned ledger."

const executionError = (message: string) =>
  new WorkflowStudyExecutionError({
    code: "execution-failed",
    message,
    retryable: false
  })

export const acceptsManifest = (manifest: StudyManifest | null): manifest is WorkflowManifest =>
  manifest !== null && Schema.is(WorkflowManifest)(manifest)

const workflowRequestFromManifest = (manifest: StudyManifest | null) =>
  acceptsManifest(manifest)
    ? WorkflowEntrySelection.validate(
      WorkflowEntrySelection.make({
        seedId: manifest.seedId,
        controls: manifest.controls
      })
    ).pipe(
      Effect.map((selection) => ({
        input: manifest.input,
        selection
      }))
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

const staticPhase = (name: string, events: ReadonlyArray<EvidenceEvent>): DemoStreamPhase<StudyRunEnv, never> => ({
  name,
  events: Effect.succeed(events)
})

export const streamPlan = (manifest: StudyManifest | null) =>
  Effect.gen(function*() {
    const workflowRequest: {
      readonly input: WorkflowStudyInput
      readonly selection: WorkflowEntrySelection
    } = yield* workflowRequestFromManifest(manifest)
    const workflowRun = yield* frozenWorkflowForRequest(workflowRequest.selection.seedId)
    const baselineExecutionRef = yield* Ref.make<Option.Option<WorkflowVariantExecution>>(Option.none())
    const optimizedExecutionRef = yield* Ref.make<Option.Option<WorkflowVariantExecution>>(Option.none())
    const searchStudyRef = yield* Ref.make<Option.Option<WorkflowSearchStudyResult>>(Option.none())
    const executionLane = policyLaneForExecutionLane(workflowRequest.selection.controls.lane)
    const baselineSelection = baselineWorkflowVariantSelection({ workflowRun, plan: workflowRequest.selection })

    const baselinePhase: DemoStreamPhase<StudyRunEnv, WorkflowStudyExecutionError> = {
      name: "baseline",
      lane: executionLane,
      events: runWorkflowVariantPhase({
        workflowRun,
        lane: workflowRequest.selection.controls.lane,
        selection: baselineSelection
      }).pipe(
        Effect.tap(({ execution }) => Ref.set(baselineExecutionRef, Option.some(execution))),
        Effect.map(({ events }) => events)
      )
    }

    const optimizationPhases: ReadonlyArray<DemoStreamPhase<StudyRunEnv, WorkflowStudyExecutionError>> =
      workflowRequest.selection.controls.optimize
        ? [{
          name: "optimization-study",
          lane: executionLane,
          events: Effect.gen(function*() {
            const dimensions = yield* workflowSearchDimensions(workflowRun, workflowRequest.selection)
            const progressEventsRef = yield* Ref.make<ReadonlyArray<EvidenceEvent>>(
              workflowSearchStartedEvents({ trialBudget: trialBudgetForDimensions(dimensions) })
            )
            const outcome = yield* runWorkflowSearchStudy({
              input: workflowRequest.input,
              workflowRun,
              lane: workflowRequest.selection.controls.lane,
              plan: workflowRequest.selection,
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

    const optimizedPhase: DemoStreamPhase<StudyRunEnv, WorkflowStudyExecutionError> = {
      name: "optimized",
      lane: executionLane,
      events: Ref.get(searchStudyRef).pipe(
        Effect.flatMap((searchStudy) => {
          const optimizedSelection = optimizedWorkflowVariantSelection({
            workflowRun,
            plan: workflowRequest.selection,
            searchStudy
          })

          return runWorkflowVariantPhase({
            workflowRun,
            lane: workflowRequest.selection.controls.lane,
            selection: optimizedSelection
          }).pipe(
            Effect.tap(({ execution }) => Ref.set(optimizedExecutionRef, Option.some(execution))),
            Effect.map(({ events }) => events)
          )
        })
      )
    }

    const workflowDeltaPhase: DemoStreamPhase<StudyRunEnv, WorkflowStudyExecutionError> = {
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

export const workflowStudyDefinition = {
  acceptsManifest,
  preloadProgram,
  streamPlan
}
