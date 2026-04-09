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
import { workflowEntryControlSurfaceForKey } from "../../../../contracts/study/workflow/selection.js"
import type { WorkflowSurfaceViewModel } from "./surface-model.js"

import { ContentCard } from "../../primitives/ContentCard.js"
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

const workflowControlSurface = {
  targetMode: workflowEntryControlSurfaceForKey("targetMode"),
  lane: workflowEntryControlSurfaceForKey("lane"),
  optimize: workflowEntryControlSurfaceForKey("optimize"),
  runtimeProfile: workflowEntryControlSurfaceForKey("runtimeProfile"),
  surfaceProfile: workflowEntryControlSurfaceForKey("surfaceProfile")
}

const WorkflowControlPanel = ({ children, description, title }: WorkflowControlPanelProps) => (
  <ContentCard density="compact">
    <Stack className="gap-3">
      <Stack className="gap-1">
        <SemanticText as="h3" className="text-ink-900" role="section-title" text={title} variant="expanded" />
        <SemanticText as="p" className="text-ink-700" role="status" text={description} variant="expanded" />
      </Stack>
      {children}
    </Stack>
  </ContentCard>
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
  <Layer className="grid gap-3 lg:grid-cols-2">
    <WorkflowControlPanel
      description={workflowControlSurface.lane?.description ?? ""}
      title={workflowControlSurface.lane?.title ?? "Execution Lane"}
    >
      <TabBar className="flex-wrap">
        {workflowExecutionLanes.map((lane) => (
          <TabButton
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
      description={workflowControlSurface.optimize?.description ?? ""}
      title={workflowControlSurface.optimize?.title ?? "Optimization Study"}
    >
      <TabBar className="flex-wrap">
        {[true, false].map((optimize) => (
          <TabButton
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
      description={workflowControlSurface.targetMode?.description ?? ""}
      title={workflowControlSurface.targetMode?.title ?? "Replay Target"}
    >
      <TabBar className="flex-wrap">
        {workflowTargetModes.map((targetMode) => (
          <TabButton
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
      description={workflowControlSurface.runtimeProfile?.description ?? ""}
      title={workflowControlSurface.runtimeProfile?.title ?? "Runtime Profile"}
    >
      <TabBar className="flex-wrap">
        {workflowRuntimeProfiles.map((runtimeProfile) => (
          <TabButton
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
      description={workflowControlSurface.surfaceProfile?.description ?? ""}
      title={workflowControlSurface.surfaceProfile?.title ?? "Surface Profile"}
    >
      <TabBar className="flex-wrap">
        {workflowSurfaceProfiles.map((surfaceProfile) => (
          <TabButton
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
  </Layer>
)
