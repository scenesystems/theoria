import type { TraceSelection } from "../../../../contracts/presentation/interactions.js"
import {
  workflowHandoffSummaryCardClassName,
  workflowHandoffSummaryMetaClassName
} from "../../recipes/workflow-handoff.recipe.js"
import { Box } from "../../structure/Box.js"
import { SemanticText } from "../../structure/SemanticText.js"
import { DetailBadge } from "../detail/DetailBadge.js"

import { WorkflowSummaryBlock } from "./WorkflowSummaryBlock.js"

const selectionTone = (itemKind: TraceSelection["itemKind"]): "neutral" | "info" | "attention" =>
  itemKind === "action" ? "attention" : itemKind === "span" ? "info" : "neutral"

type CarriedSelectionSummaryProps = {
  readonly emptyText?: string
  readonly selection: TraceSelection | null
}

export const CarriedSelectionSummary = ({
  emptyText = "No trace selection is currently carried into workflow.",
  selection
}: CarriedSelectionSummaryProps) => (
  <WorkflowSummaryBlock
    className={workflowHandoffSummaryCardClassName({})}
    meta={selection === null
      ? <SemanticText role="detail-label">Carried selection</SemanticText>
      : (
        <Box className={workflowHandoffSummaryMetaClassName({})}>
          <SemanticText role="detail-label">Carried selection</SemanticText>
          <DetailBadge tone={selectionTone(selection.itemKind)}>{selection.itemKind}</DetailBadge>
        </Box>
      )}
    summary={selection === null ? emptyText : selection.quote ?? selection.contextLabel}
    title={selection === null ? undefined : selection.summary}
  />
)
