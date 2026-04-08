import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import type { ReactNode } from "react"

import { authorityIdsForEntry } from "../../../../contracts/entry/focus.js"
import { workflowComparisonOptions } from "../../../../contracts/study/workflow/comparison/comparison.js"
import {
  makeWorkflowEntrySelection,
  workflowComparisonComparisonModeLabel,
  workflowComparisonComparisonModes,
  workflowComparisonExecutionLaneLabel,
  workflowComparisonExecutionLanes,
  workflowComparisonOptimizeLabel,
  workflowComparisonRuntimeProfileLabel,
  workflowComparisonRuntimeProfiles,
  workflowComparisonSurfaceProfileLabel,
  workflowComparisonSurfaceProfiles,
  workflowEntryControlsSurface,
  workflowEntryManifestSurface
} from "../../../../contracts/study/workflow/comparison/run.js"
import {
  selectWorkflowComparisonModeAtom,
  selectWorkflowExecutionLaneAtom,
  selectWorkflowOptimizeAtom,
  selectWorkflowRuntimeProfileAtom,
  selectWorkflowSeedAtom,
  selectWorkflowSurfaceProfileAtom
} from "../../../atoms/run/actions.js"
import {
  surfaceCanonicalFrameAtom,
  surfaceDraftAtom,
  surfaceEvidenceSectionsAtom,
  surfaceRunStateAtom
} from "../../../atoms/surface/state.js"
import { ContentCard } from "../../primitives/ContentCard.js"
import { Layer, Stack } from "../../primitives/Layout.js"
import { MetricCard } from "../../primitives/MetricCard.js"
import { SemanticText } from "../../primitives/SemanticText.js"
import { TabBar, TabButton } from "../../primitives/TabBar.js"
import { workflowComparisonSurfaceViewModel } from "./surface-model.js"
import { WorkflowRichness } from "./WorkflowRichness.js"

const workflowEntryId = "workflow"
const workflowComparisonAuthorities = authorityIdsForEntry("workflow")
const workflowComparisonExecutionLaneControl = workflowEntryControlsSurface.find((control) => control.key === "lane")
const workflowComparisonOptimizeControl = workflowEntryControlsSurface.find((control) => control.key === "optimize")
const workflowComparisonComparisonModeControl = workflowEntryControlsSurface.find(
  (control) => control.key === "comparisonMode"
)
const workflowComparisonRuntimeProfileControl = workflowEntryControlsSurface.find(
  (control) => control.key === "runtimeProfile"
)
const workflowComparisonSurfaceProfileControl = workflowEntryControlsSurface.find(
  (control) => control.key === "surfaceProfile"
)

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

export const WorkflowControl = () => {
  const draft = useAtomValue(surfaceDraftAtom(workflowEntryId))
  const frame = useAtomValue(surfaceCanonicalFrameAtom(workflowEntryId))
  const run = useAtomValue(surfaceRunStateAtom(workflowEntryId))
  const sections = useAtomValue(surfaceEvidenceSectionsAtom(workflowEntryId))
  const viewModel = workflowComparisonSurfaceViewModel({
    draftPlan: draft.entryId === workflowEntryId ? draft : makeWorkflowEntrySelection(),
    frame,
    run,
    sections
  })
  const selectWorkflowSeed = useAtomSet(selectWorkflowSeedAtom)
  const selectComparisonMode = useAtomSet(selectWorkflowComparisonModeAtom)
  const selectExecutionLane = useAtomSet(selectWorkflowExecutionLaneAtom)
  const selectOptimize = useAtomSet(selectWorkflowOptimizeAtom)
  const selectRuntimeProfile = useAtomSet(selectWorkflowRuntimeProfileAtom)
  const selectSurfaceProfile = useAtomSet(selectWorkflowSurfaceProfileAtom)
  const selectedOption = viewModel.selection

  return (
    <Stack className="max-w-4xl gap-4 py-2">
      <Stack className="gap-2">
        <SemanticText
          as="h3"
          className="text-ink-900"
          role="section-title"
          text={workflowEntryManifestSurface.title}
          variant="expanded"
        />
        <SemanticText
          as="p"
          className="text-ink-700"
          role="status"
          text={workflowEntryManifestSurface.description}
          variant="expanded"
        />
      </Stack>

      <TabBar className="flex-wrap">
        {workflowComparisonOptions.map((option) => (
          <TabButton
            key={option.id}
            active={option.id === selectedOption.id}
            disabled={viewModel.selectionLocked}
            label={option.label}
            onClick={() => {
              selectWorkflowSeed(option.id)
            }}
          />
        ))}
      </TabBar>

      <Layer className="grid gap-3 lg:grid-cols-2">
        <ControlPanel
          description={workflowComparisonExecutionLaneControl?.description ?? ""}
          title={workflowComparisonExecutionLaneControl?.title ?? "Execution Lane"}
        >
          <TabBar className="flex-wrap">
            {workflowComparisonExecutionLanes.map((lane) => (
              <TabButton
                key={lane}
                active={lane === viewModel.plan.controls.lane}
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
          description={workflowComparisonOptimizeControl?.description ?? ""}
          title={workflowComparisonOptimizeControl?.title ?? "Optimization Study"}
        >
          <TabBar className="flex-wrap">
            {[true, false].map((optimize) => (
              <TabButton
                key={optimize ? "optimize-on" : "optimize-off"}
                active={optimize === viewModel.plan.controls.optimize}
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
          description={workflowComparisonComparisonModeControl?.description ?? ""}
          title={workflowComparisonComparisonModeControl?.title ?? "Comparison Target"}
        >
          <TabBar className="flex-wrap">
            {workflowComparisonComparisonModes.map((comparisonMode) => (
              <TabButton
                key={comparisonMode}
                active={comparisonMode === viewModel.plan.controls.comparisonMode}
                disabled={viewModel.selectionLocked
                  || (!viewModel.plan.controls.optimize && comparisonMode === "search-winner")}
                label={workflowComparisonComparisonModeLabel(comparisonMode)}
                onClick={() => {
                  selectComparisonMode(comparisonMode)
                }}
              />
            ))}
          </TabBar>
        </ControlPanel>

        <ControlPanel
          description={workflowComparisonRuntimeProfileControl?.description ?? ""}
          title={workflowComparisonRuntimeProfileControl?.title ?? "Runtime Profile"}
        >
          <TabBar className="flex-wrap">
            {workflowComparisonRuntimeProfiles.map((runtimeProfile) => (
              <TabButton
                key={runtimeProfile}
                active={runtimeProfile === viewModel.plan.controls.runtimeProfile}
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
          description={workflowComparisonSurfaceProfileControl?.description ?? ""}
          title={workflowComparisonSurfaceProfileControl?.title ?? "Surface Profile"}
        >
          <TabBar className="flex-wrap">
            {workflowComparisonSurfaceProfiles.map((surfaceProfile) => (
              <TabButton
                key={surfaceProfile}
                active={surfaceProfile === viewModel.plan.controls.surfaceProfile}
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
            text="This scenario is frozen from the current run session. Reset the run to switch to a different workflow comparison."
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
            <MetricCard
              label="Execution Lane"
              value={workflowComparisonExecutionLaneLabel(viewModel.plan.controls.lane)}
            />
            <MetricCard
              label="Optimization"
              value={workflowComparisonOptimizeLabel(viewModel.plan.controls.optimize)}
            />
            <MetricCard
              label="Comparison Target"
              value={workflowComparisonComparisonModeLabel(viewModel.plan.controls.comparisonMode)}
            />
            <MetricCard
              label="Runtime Profile"
              value={workflowComparisonRuntimeProfileLabel(viewModel.plan.controls.runtimeProfile)}
            />
            <MetricCard
              label="Surface Profile"
              value={workflowComparisonSurfaceProfileLabel(viewModel.plan.controls.surfaceProfile)}
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

      <WorkflowRichness viewModel={viewModel} />
    </Stack>
  )
}
