import type { PinnedObjective } from "../../../../contracts/presentation/interactions.js"
import {
  workflowHandoffSummaryCardClassName,
  workflowHandoffSummaryMetaClassName
} from "../../recipes/workflow-handoff.recipe.js"
import { Box } from "../../structure/Box.js"
import { SemanticText } from "../../structure/SemanticText.js"
import { DetailBadge } from "../detail/DetailBadge.js"

import { WorkflowSummaryBlock } from "./WorkflowSummaryBlock.js"

const objectiveTone = (status: PinnedObjective["status"]): "neutral" | "attention" | "positive" =>
  status === "handoff-ready" ? "positive" : status === "active" ? "attention" : "neutral"

type PinnedObjectiveSummaryProps = {
  readonly objective: PinnedObjective
}

export const PinnedObjectiveSummary = ({ objective }: PinnedObjectiveSummaryProps) => (
  <WorkflowSummaryBlock
    className={workflowHandoffSummaryCardClassName({})}
    meta={
      <Box className={workflowHandoffSummaryMetaClassName({})}>
        <SemanticText role="detail-label">Pinned objective</SemanticText>
        <DetailBadge tone={objectiveTone(objective.status)}>{objective.status}</DetailBadge>
      </Box>
    }
    summary={objective.summary}
    title={objective.title}
  >
    <SemanticText role="pane-meta">{objective.selection.summary}</SemanticText>
  </WorkflowSummaryBlock>
)
