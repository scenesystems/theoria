import type { ReactNode } from "react"

import {
  workflowExecutionLaneLabel,
  workflowExecutionLanes,
  workflowOptimizeLabel,
  workflowRuntimeProfileLabel,
  workflowRuntimeProfiles,
  workflowSurfaceProfileLabel,
  workflowSurfaceProfiles,
  workflowTargetModeLabel,
  workflowTargetModes
} from "../../../../contracts/study/workflow/controls.js"
import type { WorkflowSurfaceViewModel } from "../../../../contracts/study/workflow/surface-presentation.js"

import { Layer, Stack } from "../../primitives/Layout.js"
import { SemanticText } from "../../primitives/SemanticText.js"
import { TabBar, TabButton } from "../../primitives/TabBar.js"

type WorkflowControlPanelProps = {
  readonly children: ReactNode
  readonly description: string
  readonly title: string
}

type WorkflowControlsGridProps = {
  readonly onSelectTargetMode: (
    targetMode: WorkflowSurfaceViewModel["plan"]["controls"]["targetMode"]
  ) => void
  readonly onSelectExecutionLane: (lane: WorkflowSurfaceViewModel["plan"]["controls"]["lane"]) => void
  readonly onSelectOptimize: (optimize: boolean) => void
  readonly onSelectRuntimeProfile: (
    runtimeProfile: WorkflowSurfaceViewModel["plan"]["controls"]["runtimeProfile"]
  ) => void
  readonly onSelectSurfaceProfile: (
    surfaceProfile: WorkflowSurfaceViewModel["plan"]["controls"]["surfaceProfile"]
  ) => void
  readonly selectionLocked: boolean
  readonly viewModel: WorkflowSurfaceViewModel
}

const WorkflowControlPanel = ({ children, description, title }: WorkflowControlPanelProps) => (
  <Layer className="grid gap-3 py-4 first:pt-0 last:pb-0 lg:grid-cols-[minmax(0,18rem)_1fr] lg:gap-6">
    <Stack className="gap-2">
      <Stack className="gap-1">
        <SemanticText as="h3" className="text-ink-900" role="section-title" text={title} variant="expanded" />
        <SemanticText as="p" className="text-ink-700" role="status" text={description} variant="expanded" />
      </Stack>
    </Stack>
    <Layer className="min-w-0">{children}</Layer>
  </Layer>
)

export const WorkflowControlsGrid = ({
  onSelectTargetMode,
  onSelectExecutionLane,
  onSelectOptimize,
  onSelectRuntimeProfile,
  onSelectSurfaceProfile,
  selectionLocked,
  viewModel
}: WorkflowControlsGridProps) => (
  <Stack className="gap-0 divide-y divide-stage-200/56 border-t border-stage-200/56">
    <WorkflowControlPanel
      description={viewModel.executionLaneControl.description}
      title={viewModel.executionLaneControl.title}
    >
      <TabBar appearance="flat">
        {workflowExecutionLanes.map((lane) => (
          <TabButton
            appearance="flat"
            key={lane}
            active={lane === viewModel.plan.controls.lane}
            disabled={selectionLocked}
            label={workflowExecutionLaneLabel(lane)}
            onClick={() => {
              onSelectExecutionLane(lane)
            }}
          />
        ))}
      </TabBar>
    </WorkflowControlPanel>

    <WorkflowControlPanel
      description={viewModel.optimizeControl.description}
      title={viewModel.optimizeControl.title}
    >
      <TabBar appearance="flat">
        {[true, false].map((optimize) => (
          <TabButton
            appearance="flat"
            key={optimize ? "optimize-on" : "optimize-off"}
            active={optimize === viewModel.plan.controls.optimize}
            disabled={selectionLocked}
            label={workflowOptimizeLabel(optimize)}
            onClick={() => {
              onSelectOptimize(optimize)
            }}
          />
        ))}
      </TabBar>
    </WorkflowControlPanel>

    <WorkflowControlPanel
      description={viewModel.targetModeControl.description}
      title={viewModel.targetModeControl.title}
    >
      <TabBar appearance="flat">
        {workflowTargetModes.map((targetMode) => (
          <TabButton
            appearance="flat"
            key={targetMode}
            active={targetMode === viewModel.plan.controls.targetMode}
            disabled={selectionLocked || (!viewModel.plan.controls.optimize && targetMode === "search-winner")}
            label={workflowTargetModeLabel(targetMode)}
            onClick={() => {
              onSelectTargetMode(targetMode)
            }}
          />
        ))}
      </TabBar>
    </WorkflowControlPanel>

    <WorkflowControlPanel
      description={viewModel.runtimeProfileControl.description}
      title={viewModel.runtimeProfileControl.title}
    >
      <TabBar appearance="flat">
        {workflowRuntimeProfiles.map((runtimeProfile) => (
          <TabButton
            appearance="flat"
            key={runtimeProfile}
            active={runtimeProfile === viewModel.plan.controls.runtimeProfile}
            disabled={selectionLocked}
            label={workflowRuntimeProfileLabel(runtimeProfile)}
            onClick={() => {
              onSelectRuntimeProfile(runtimeProfile)
            }}
          />
        ))}
      </TabBar>
    </WorkflowControlPanel>

    <WorkflowControlPanel
      description={viewModel.surfaceProfileControl.description}
      title={viewModel.surfaceProfileControl.title}
    >
      <TabBar appearance="flat">
        {workflowSurfaceProfiles.map((surfaceProfile) => (
          <TabButton
            appearance="flat"
            key={surfaceProfile}
            active={surfaceProfile === viewModel.plan.controls.surfaceProfile}
            disabled={selectionLocked}
            label={workflowSurfaceProfileLabel(surfaceProfile)}
            onClick={() => {
              onSelectSurfaceProfile(surfaceProfile)
            }}
          />
        ))}
      </TabBar>
    </WorkflowControlPanel>
  </Stack>
)
