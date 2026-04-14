import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"

import { workflowRichnessEmptyText } from "../../../../contracts/study/workflow/surface-richness-presentation.js"
import {
  selectWorkflowExecutionLaneAtom,
  selectWorkflowOptimizeAtom,
  selectWorkflowRuntimeProfileAtom,
  selectWorkflowSeedAtom,
  selectWorkflowSurfaceProfileAtom,
  selectWorkflowTargetModeAtom
} from "../../../atoms/workflow/draft-actions.js"
import { workflowSurfaceViewModelAtom } from "../../../atoms/workflow/surface-view-model.js"
import { Layer, Stack } from "../../primitives/Layout.js"
import { SemanticText } from "../../primitives/SemanticText.js"
import { SurfaceSubsection } from "../../primitives/SurfaceSubsection.js"
import { WorkflowControlsGrid } from "./WorkflowControlsGrid.js"
import { WorkflowPlanSummary } from "./WorkflowPlanSummary.js"
import { WorkflowRichness } from "./WorkflowRichness.js"
import { WorkflowScenarioSelector } from "./WorkflowScenarioSelector.js"

const pluralSuffix = (count: number): string => count === 1 ? "" : "s"

const workflowHandoffCarryText = (annotationCount: number, objectiveCount: number): string =>
  `Carried from the interaction workspace: ${objectiveCount} objective${
    pluralSuffix(objectiveCount)
  } and ${annotationCount} annotation${pluralSuffix(annotationCount)}.`

export const WorkflowControl = () => {
  const viewModel = useAtomValue(workflowSurfaceViewModelAtom)
  const selectWorkflowSeed = useAtomSet(selectWorkflowSeedAtom)
  const selectTargetMode = useAtomSet(selectWorkflowTargetModeAtom)
  const selectExecutionLane = useAtomSet(selectWorkflowExecutionLaneAtom)
  const selectOptimize = useAtomSet(selectWorkflowOptimizeAtom)
  const selectRuntimeProfile = useAtomSet(selectWorkflowRuntimeProfileAtom)
  const selectSurfaceProfile = useAtomSet(selectWorkflowSurfaceProfileAtom)
  const handoffDraft = viewModel.handoff
  const selector = viewModel.selector

  return (
    <Stack className="w-full gap-0 divide-y divide-stage-200/72 py-1">
      {handoffDraft === null
        ? null
        : (
          <Layer className="pb-6">
            <SurfaceSubsection
              appearance="flush"
              eyebrow={handoffDraft.status === "ready" ? "Trace-native handoff · ready" : "Trace-native handoff"}
              summary={handoffDraft.summary}
              title={handoffDraft.title}
            >
              <Stack className="gap-3">
                <SemanticText
                  as="p"
                  className="text-ink-700"
                  role="status"
                  text={workflowHandoffCarryText(handoffDraft.annotationIds.length, handoffDraft.objectiveIds.length)}
                  variant="expanded"
                />
                {handoffDraft.selection === null
                  ? null
                  : (
                    <Stack className="gap-1.5">
                      <SemanticText
                        as="span"
                        className="text-ink-500"
                        role="row-label"
                        text="Selected trace"
                        variant="compact"
                      />
                      <SemanticText
                        as="p"
                        className="text-ink-900"
                        role="row-value"
                        text={handoffDraft.selection.summary}
                        variant="expanded"
                      />
                      {handoffDraft.selection.quote === null
                        ? null
                        : (
                          <SemanticText
                            as="p"
                            className="text-ink-700"
                            role="status"
                            text={handoffDraft.selection.quote}
                            variant="expanded"
                          />
                        )}
                    </Stack>
                  )}
              </Stack>
            </SurfaceSubsection>
          </Layer>
        )}
      <Layer className="pb-6">
        <WorkflowScenarioSelector
          onSelectSeed={selectWorkflowSeed}
          selector={selector}
        />
      </Layer>

      <SurfaceSubsection
        appearance="flush"
        className="py-6"
        summary="Set the runtime, search, and replay choices that define this study run."
        title="Shape the run"
      >
        <Stack className="gap-4">
          <WorkflowControlsGrid
            onSelectTargetMode={selectTargetMode}
            onSelectExecutionLane={selectExecutionLane}
            onSelectOptimize={selectOptimize}
            onSelectRuntimeProfile={selectRuntimeProfile}
            onSelectSurfaceProfile={selectSurfaceProfile}
            selectionLocked={selector.locked}
            viewModel={viewModel}
          />

          {selector.locked
            ? (
              <SemanticText
                as="p"
                className="text-ink-700"
                role="status"
                text={workflowRichnessEmptyText("selection-locked")}
                variant="expanded"
              />
            )
            : null}
        </Stack>
      </SurfaceSubsection>

      <Layer className="py-6">
        <WorkflowPlanSummary viewModel={viewModel} />
      </Layer>

      <Layer className="py-6">
        <WorkflowRichness viewModel={viewModel} />
      </Layer>
    </Stack>
  )
}
