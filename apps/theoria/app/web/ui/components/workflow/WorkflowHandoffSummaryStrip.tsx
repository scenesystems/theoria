import type { PinnedObjective, WorkflowHandoffDraft } from "../../../../contracts/presentation/interactions.js"
import { workflowHandoffSummaryListClassName } from "../../recipes/workflow-handoff.recipe.js"
import { Box } from "../../structure/Box.js"

import { CarriedSelectionSummary } from "./CarriedSelectionSummary.js"
import { PinnedObjectiveSummary } from "./PinnedObjectiveSummary.js"
import { ReopenInteractionAction } from "./ReopenInteractionAction.js"
import { WorkflowWorkspaceStrip } from "./WorkflowWorkspaceStrip.js"

type WorkflowHandoffSummaryStripProps = {
  readonly draft: WorkflowHandoffDraft | null
  readonly emptyText?: string
  readonly objectives?: ReadonlyArray<PinnedObjective>
  readonly onReopenInteraction?: () => void
}

export const WorkflowHandoffSummaryStrip = ({
  draft,
  emptyText,
  objectives = [],
  onReopenInteraction
}: WorkflowHandoffSummaryStripProps) => (
  <WorkflowWorkspaceStrip
    actions={
      <ReopenInteractionAction
        {...(onReopenInteraction === undefined ? { disabled: true } : { onPress: onReopenInteraction })}
      />
    }
    label="Carried from interaction"
    summary={draft?.summary ?? "Workflow continues from trace-grounded context, not a blank setup surface."}
    title={draft?.title ?? "Workflow handoff context"}
  >
    <Box className={workflowHandoffSummaryListClassName({})}>
      <CarriedSelectionSummary
        {...(emptyText === undefined ? {} : { emptyText })}
        selection={draft?.selection ?? null}
      />
      {objectives.map((objective) => <PinnedObjectiveSummary key={objective.id} objective={objective} />)}
    </Box>
  </WorkflowWorkspaceStrip>
)
