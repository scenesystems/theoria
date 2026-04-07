import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import type { ReactNode } from "react"

import { authorityIdsForConsumer } from "../../../contracts/proving-substrate.js"
import {
  workflowComparisonComparisonModeLabel,
  workflowComparisonComparisonModes,
  workflowComparisonExecutionLaneLabel,
  workflowComparisonExecutionLanes,
  workflowComparisonOptimizeLabel,
  workflowComparisonRuntimeProfileLabel,
  workflowComparisonRuntimeProfiles,
  workflowComparisonSurfaceProfileLabel,
  workflowComparisonSurfaceProfiles
} from "../../../contracts/workflow/comparison-run.js"
import { workflowComparisonOptions } from "../../../contracts/workflow/comparison.js"
import { workflowComparisonSurfaceViewModelAtom } from "../../atoms/workflow-comparison-surface.js"
import {
  selectWorkflowComparisonComparisonModeAtom,
  selectWorkflowComparisonExecutionLaneAtom,
  selectWorkflowComparisonOptimizeAtom,
  selectWorkflowComparisonRuntimeProfileAtom,
  selectWorkflowComparisonSelectionAtom,
  selectWorkflowComparisonSurfaceProfileAtom
} from "../../atoms/workflow-comparison.js"
import { ContentCard } from "../primitives/ContentCard.js"
import { Layer, Stack } from "../primitives/Layout.js"
import { MetricCard } from "../primitives/MetricCard.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { TabBar, TabButton } from "../primitives/TabBar.js"
import { WorkflowComparisonRichness } from "./WorkflowComparisonRichness.js"

const workflowComparisonAuthorities = authorityIdsForConsumer("workflow-comparison")

const ControlPanel = ({
  children,
  description,
  title
}: {
  readonly children: ReactNode
  readonly description: string
  readonly title: string
}) => (
  <ContentCard density="compact">
    <Stack className="gap-3">
      <Stack className="gap-1">
        <SemanticText
          as="h3"
          className="text-ink-900"
          role="section-title"
          text={title}
          variant="expanded"
        />
        <SemanticText
          as="p"
          className="text-ink-700"
          role="status"
          text={description}
          variant="expanded"
        />
      </Stack>
      {children}
    </Stack>
  </ContentCard>
)

export const WorkflowComparisonControl = () => {
  const viewModel = useAtomValue(workflowComparisonSurfaceViewModelAtom)
  const selectWorkflowComparison = useAtomSet(selectWorkflowComparisonSelectionAtom)
  const selectComparisonMode = useAtomSet(selectWorkflowComparisonComparisonModeAtom)
  const selectExecutionLane = useAtomSet(selectWorkflowComparisonExecutionLaneAtom)
  const selectOptimize = useAtomSet(selectWorkflowComparisonOptimizeAtom)
  const selectRuntimeProfile = useAtomSet(selectWorkflowComparisonRuntimeProfileAtom)
  const selectSurfaceProfile = useAtomSet(selectWorkflowComparisonSurfaceProfileAtom)
  const selectedOption = viewModel.selection

  return (
    <Stack className="max-w-4xl gap-4 py-2">
      <Stack className="gap-2">
        <SemanticText
          as="h3"
          className="text-ink-900"
          role="section-title"
          text="Workflow Scenario"
          variant="expanded"
        />
        <SemanticText
          as="p"
          className="text-ink-700"
          role="status"
          text="Freeze one published workflow comparison before running. The server will execute baseline, study, and optimized phases on one canonical ledger while the browser only projects the resulting graph and evidence stream."
          variant="expanded"
        />
      </Stack>

      <TabBar className="flex-wrap">
        {workflowComparisonOptions.map((option) => (
          <TabButton
            key={option.id}
            active={option.id === viewModel.plan.comparisonId}
            disabled={viewModel.selectionLocked}
            label={option.label}
            onClick={() => {
              selectWorkflowComparison(option.id)
            }}
          />
        ))}
      </TabBar>

      <Layer className="grid gap-3 lg:grid-cols-2">
        <ControlPanel
          description="Freeze the server execution lane as part of the run plan rather than inferring it at request time."
          title="Execution Lane"
        >
          <TabBar className="flex-wrap">
            {workflowComparisonExecutionLanes.map((lane) => (
              <TabButton
                key={lane}
                active={lane === viewModel.plan.lane}
                disabled={viewModel.selectionLocked}
                label={workflowComparisonExecutionLaneLabel(lane)}
                onClick={() => {
                  selectExecutionLane(lane)
                }}
              />
            ))}
          </TabBar>
        </ControlPanel>

        <ControlPanel
          description="Decide whether the frozen run plan opens the search-study lane or replays only the authored optimized target."
          title="Optimization Study"
        >
          <TabBar className="flex-wrap">
            {[true, false].map((optimize) => (
              <TabButton
                key={optimize ? "optimize-on" : "optimize-off"}
                active={optimize === viewModel.plan.optimize}
                disabled={viewModel.selectionLocked}
                label={workflowComparisonOptimizeLabel(optimize)}
                onClick={() => {
                  selectOptimize(optimize)
                }}
              />
            ))}
          </TabBar>
        </ControlPanel>

        <ControlPanel
          description="Freeze whether the final comparison targets the authored optimized replay or the search-study winner."
          title="Comparison Target"
        >
          <TabBar className="flex-wrap">
            {workflowComparisonComparisonModes.map((comparisonMode) => (
              <TabButton
                key={comparisonMode}
                active={comparisonMode === viewModel.plan.comparisonMode}
                disabled={viewModel.selectionLocked || (!viewModel.plan.optimize && comparisonMode === "search-winner")}
                label={workflowComparisonComparisonModeLabel(comparisonMode)}
                onClick={() => {
                  selectComparisonMode(comparisonMode)
                }}
              />
            ))}
          </TabBar>
        </ControlPanel>

        <ControlPanel
          description="Freeze the runtime preference that search and replay are allowed to use when the graph exposes runtime-profile knobs."
          title="Runtime Profile"
        >
          <TabBar className="flex-wrap">
            {workflowComparisonRuntimeProfiles.map((runtimeProfile) => (
              <TabButton
                key={runtimeProfile}
                active={runtimeProfile === viewModel.plan.runtimeProfile}
                disabled={viewModel.selectionLocked}
                label={workflowComparisonRuntimeProfileLabel(runtimeProfile)}
                onClick={() => {
                  selectRuntimeProfile(runtimeProfile)
                }}
              />
            ))}
          </TabBar>
        </ControlPanel>

        <ControlPanel
          description="Freeze the render-surface preference that the graph and render-evaluation lane should honor when a surface-profile knob is available."
          title="Surface Profile"
        >
          <TabBar className="flex-wrap">
            {workflowComparisonSurfaceProfiles.map((surfaceProfile) => (
              <TabButton
                key={surfaceProfile}
                active={surfaceProfile === viewModel.plan.surfaceProfile}
                disabled={viewModel.selectionLocked}
                label={workflowComparisonSurfaceProfileLabel(surfaceProfile)}
                onClick={() => {
                  selectSurfaceProfile(surfaceProfile)
                }}
              />
            ))}
          </TabBar>
        </ControlPanel>
      </Layer>

      {viewModel.selectionLocked
        ? (
          <SemanticText
            as="p"
            className="text-ink-700"
            role="status"
            text="This scenario is frozen from the current run plan. Reset the run to switch to a different workflow comparison."
            variant="expanded"
          />
        )
        : null}

      <ContentCard density="standard">
        <Stack className="gap-4">
          <Stack className="gap-2">
            <SemanticText
              as="h3"
              className="text-ink-900"
              role="section-title"
              text={selectedOption.label}
              variant="expanded"
            />
            <SemanticText
              as="p"
              className="text-ink-700"
              role="status"
              text={selectedOption.summary}
              variant="expanded"
            />
          </Stack>

          <Layer className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard label="Execution Lane" value={workflowComparisonExecutionLaneLabel(viewModel.plan.lane)} />
            <MetricCard label="Optimization" value={workflowComparisonOptimizeLabel(viewModel.plan.optimize)} />
            <MetricCard
              label="Comparison Target"
              value={workflowComparisonComparisonModeLabel(viewModel.plan.comparisonMode)}
            />
            <MetricCard
              label="Runtime Profile"
              value={workflowComparisonRuntimeProfileLabel(viewModel.plan.runtimeProfile)}
            />
            <MetricCard
              label="Surface Profile"
              value={workflowComparisonSurfaceProfileLabel(viewModel.plan.surfaceProfile)}
            />
            <MetricCard label="Authorities" value={String(workflowComparisonAuthorities.length)} unit="packages" />
            <MetricCard label="Run Story" value={viewModel.runStory} />
            <MetricCard label="Phase" value={viewModel.phaseLabel} />
          </Layer>

          <SemanticText
            as="p"
            className="text-ink-700"
            role="status"
            text={`Published authorities in play: ${
              workflowComparisonAuthorities.join(", ")
            }. ${viewModel.phaseDetail}`}
            variant="expanded"
          />
        </Stack>
      </ContentCard>

      <WorkflowComparisonRichness viewModel={viewModel} />
    </Stack>
  )
}
