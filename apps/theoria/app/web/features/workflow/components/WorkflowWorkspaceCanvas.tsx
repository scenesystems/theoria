import { Match } from "effect"

import type { WorkflowHandoffDraft } from "../../../../contracts/presentation/interactions.js"
import type { SurfaceViewModel } from "../../../../contracts/presentation/surface-presentation.js"
import type { WorkflowCanvasMode } from "../../../../contracts/presentation/workflow.js"
import type {
  WorkflowExecutionLane,
  WorkflowRuntimeProfile,
  WorkflowSurfaceProfile,
  WorkflowTargetMode
} from "../../../../contracts/study/workflow/controls.js"
import type { WorkflowSeedId } from "../../../../contracts/study/workflow/manifest.js"
import { workflowPlanSummaryMetricRows } from "../../../../contracts/study/workflow/plan-presentation.js"
import type { WorkflowSurfaceViewModel } from "../../../../contracts/study/workflow/surface-presentation.js"
import {
  WorkflowControlPanel,
  type WorkflowControlSection
} from "../../../ui/components/workflow/WorkflowControlPanel.js"
import { WorkflowHandoffSummaryStrip } from "../../../ui/components/workflow/WorkflowHandoffSummaryStrip.js"
import { WorkflowResultsCanvas } from "../../../ui/components/workflow/WorkflowResultsCanvas.js"
import { WorkflowResultsSummaryPanel } from "../../../ui/components/workflow/WorkflowResultsSummaryPanel.js"
import { WorkflowRunPlanPanel } from "../../../ui/components/workflow/WorkflowRunPlanPanel.js"
import { WorkflowScenarioSelectorPanel } from "../../../ui/components/workflow/WorkflowScenarioSelectorPanel.js"
import { WorkflowSetupCanvas } from "../../../ui/components/workflow/WorkflowSetupCanvas.js"
import { WorkflowRichness } from "../../../view/study/workflow/WorkflowRichness.js"

const workflowControlSections = ({
  onSelectExecutionLane,
  onSelectOptimize,
  onSelectRuntimeProfile,
  onSelectSurfaceProfile,
  onSelectTargetMode,
  viewModel
}: {
  readonly onSelectExecutionLane: (lane: WorkflowExecutionLane) => void
  readonly onSelectOptimize: (optimize: boolean) => void
  readonly onSelectRuntimeProfile: (runtimeProfile: WorkflowRuntimeProfile) => void
  readonly onSelectSurfaceProfile: (surfaceProfile: WorkflowSurfaceProfile) => void
  readonly onSelectTargetMode: (targetMode: WorkflowTargetMode) => void
  readonly viewModel: WorkflowSurfaceViewModel
}): ReadonlyArray<WorkflowControlSection> => [
  {
    description: viewModel.executionLaneControl.description,
    key: viewModel.executionLaneControl.key,
    options: viewModel.executionLaneControl.options.map((option) => ({
      active: option.value === viewModel.plan.controls.lane,
      key: String(option.value),
      label: option.label,
      onSelect: Match.value(option.value).pipe(
        Match.when("deterministic-fallback", () => () => {
          onSelectExecutionLane("deterministic-fallback")
        }),
        Match.when("provider", () => () => {
          onSelectExecutionLane("provider")
        }),
        Match.orElse(() => () => undefined)
      )
    })),
    title: viewModel.executionLaneControl.title
  },
  {
    description: viewModel.optimizeControl.description,
    key: viewModel.optimizeControl.key,
    options: viewModel.optimizeControl.options.map((option) => ({
      active: option.value === viewModel.plan.controls.optimize,
      key: String(option.value),
      label: option.label,
      onSelect: Match.value(option.value).pipe(
        Match.when(true, () => () => {
          onSelectOptimize(true)
        }),
        Match.when(false, () => () => {
          onSelectOptimize(false)
        }),
        Match.orElse(() => () => undefined)
      )
    })),
    title: viewModel.optimizeControl.title
  },
  {
    description: viewModel.targetModeControl.description,
    key: viewModel.targetModeControl.key,
    options: viewModel.targetModeControl.options.map((option) => ({
      active: option.value === viewModel.plan.controls.targetMode,
      key: String(option.value),
      label: option.label,
      onSelect: Match.value(option.value).pipe(
        Match.when("authored-optimized", () => () => {
          onSelectTargetMode("authored-optimized")
        }),
        Match.when("search-winner", () => () => {
          onSelectTargetMode("search-winner")
        }),
        Match.orElse(() => () => undefined)
      )
    })),
    title: viewModel.targetModeControl.title
  },
  {
    description: viewModel.runtimeProfileControl.description,
    key: viewModel.runtimeProfileControl.key,
    options: viewModel.runtimeProfileControl.options.map((option) => ({
      active: option.value === viewModel.plan.controls.runtimeProfile,
      key: String(option.value),
      label: option.label,
      onSelect: Match.value(option.value).pipe(
        Match.when("authored", () => () => {
          onSelectRuntimeProfile("authored")
        }),
        Match.when("preferred", () => () => {
          onSelectRuntimeProfile("preferred")
        }),
        Match.when("fastest", () => () => {
          onSelectRuntimeProfile("fastest")
        }),
        Match.orElse(() => () => undefined)
      )
    })),
    title: viewModel.runtimeProfileControl.title
  },
  {
    description: viewModel.surfaceProfileControl.description,
    key: viewModel.surfaceProfileControl.key,
    options: viewModel.surfaceProfileControl.options.map((option) => ({
      active: option.value === viewModel.plan.controls.surfaceProfile,
      key: String(option.value),
      label: option.label,
      onSelect: Match.value(option.value).pipe(
        Match.when("authored", () => () => {
          onSelectSurfaceProfile("authored")
        }),
        Match.when("sidebar", () => () => {
          onSelectSurfaceProfile("sidebar")
        }),
        Match.when("full-panel", () => () => {
          onSelectSurfaceProfile("full-panel")
        }),
        Match.orElse(() => () => undefined)
      )
    })),
    title: viewModel.surfaceProfileControl.title
  }
]

type WorkflowWorkspaceCanvasProps = {
  readonly activeCanvasMode: WorkflowCanvasMode
  readonly handoffDraft: WorkflowHandoffDraft | null
  readonly onSelectExecutionLane: (lane: WorkflowExecutionLane) => void
  readonly onSelectOptimize: (optimize: boolean) => void
  readonly onSelectRuntimeProfile: (runtimeProfile: WorkflowRuntimeProfile) => void
  readonly onSelectSeed: (seedId: WorkflowSeedId) => void
  readonly onSelectSurfaceProfile: (surfaceProfile: WorkflowSurfaceProfile) => void
  readonly onSelectTargetMode: (targetMode: WorkflowTargetMode) => void
  readonly resultsAvailable: boolean
  readonly surfaceViewModel: SurfaceViewModel
  readonly workflowViewModel: WorkflowSurfaceViewModel
}

export const WorkflowWorkspaceCanvas = ({
  activeCanvasMode,
  handoffDraft,
  onSelectExecutionLane,
  onSelectOptimize,
  onSelectRuntimeProfile,
  onSelectSeed,
  onSelectSurfaceProfile,
  onSelectTargetMode,
  resultsAvailable,
  surfaceViewModel,
  workflowViewModel
}: WorkflowWorkspaceCanvasProps) => {
  const runPlanMetrics = workflowPlanSummaryMetricRows({
    phaseLabel: workflowViewModel.phaseLabel,
    plan: workflowViewModel.plan,
    runStory: workflowViewModel.runStory
  })

  return Match.value(activeCanvasMode).pipe(
    Match.when("setup", () => (
      <WorkflowSetupCanvas
        label="Workflow setup"
        statusItems={[workflowViewModel.phaseLabel, surfaceViewModel.status]}
        summary="Shape the run from carried trace context, bounded workflow choices, and a visible execution plan."
        title="Shape workflow run"
      >
        <WorkflowHandoffSummaryStrip
          draft={handoffDraft}
          emptyText="No trace selection is currently carried into workflow."
        />
        <WorkflowScenarioSelectorPanel
          currentWorkflowLabel={workflowViewModel.selector.selected.label}
          currentWorkflowSummary={workflowViewModel.selector.selected.summary}
          options={workflowViewModel.selector.options.map((option) => ({
            active: option.reference.seedId === workflowViewModel.selector.selected.reference.seedId,
            disabled: workflowViewModel.selector.locked,
            key: option.reference.seedId,
            label: option.label,
            onSelect: () => {
              onSelectSeed(option.reference.seedId)
            }
          }))}
          statusItems={[workflowViewModel.selector.surface.title, workflowViewModel.runStory]}
        />
        <WorkflowControlPanel
          sections={workflowControlSections({
            onSelectExecutionLane,
            onSelectOptimize,
            onSelectRuntimeProfile,
            onSelectSurfaceProfile,
            onSelectTargetMode,
            viewModel: workflowViewModel
          })}
          statusItems={[workflowViewModel.phaseLabel, workflowViewModel.phaseDetail]}
          summary="Bound the workflow choices that shape this run without fragmenting the study into separate tabs."
          title="Run controls"
        />
        <WorkflowRunPlanPanel
          currentWorkflowLabel={workflowViewModel.selector.selected.label}
          currentWorkflowSummary={workflowViewModel.selector.selected.summary}
          metrics={runPlanMetrics}
          phaseDetail={workflowViewModel.phaseDetail}
        />
      </WorkflowSetupCanvas>
    )),
    Match.when("results", () => (
      <WorkflowResultsCanvas
        emptyState="Run the study to generate workflow evidence, then return here to read the result as one continuous surface."
        label="Workflow results"
        statusItems={[
          workflowViewModel.phaseLabel,
          `${workflowViewModel.progress.metrics.length} result metric${
            workflowViewModel.progress.metrics.length === 1 ? "" : "s"
          }`
        ]}
        summary="Read the completed workflow as a summary-first result, then drill into evidence and execution detail from the inspector."
        summaryBlock={
          <WorkflowHandoffSummaryStrip
            draft={handoffDraft}
            emptyText="No trace selection is currently carried into workflow."
          />
        }
        title="Read workflow result"
      >
        <WorkflowResultsSummaryPanel
          headline={resultsAvailable ? workflowViewModel.phaseLabel : "Results pending"}
          metrics={workflowViewModel.progress.metrics.map((metric) => ({
            label: metric.label,
            value: metric.value
          }))}
          statusItems={[workflowViewModel.selector.selected.label, workflowViewModel.runStory]}
          supportingSummary={workflowViewModel.phaseDetail}
        />
        <WorkflowRichness viewModel={workflowViewModel} />
      </WorkflowResultsCanvas>
    )),
    Match.exhaustive
  )
}
