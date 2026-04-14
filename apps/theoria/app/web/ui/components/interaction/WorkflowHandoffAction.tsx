import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline"

import type { WorkflowHandoffDraft } from "../../../../contracts/presentation/interactions.js"
import {
  workflowHandoffActionClassName,
  workflowHandoffActionSummaryClassName
} from "../../recipes/handoff-action.recipe.js"
import { SemanticText } from "../../structure/SemanticText.js"
import { Stack } from "../../structure/Stack.js"
import { Button } from "../action/Button.js"
import { Badge } from "../feedback/Badge.js"

type WorkflowHandoffActionProps = {
  readonly className?: string
  readonly draft: WorkflowHandoffDraft | null
  readonly onPress?: (draft: WorkflowHandoffDraft) => void
}

export const WorkflowHandoffAction = ({ className, draft, onPress }: WorkflowHandoffActionProps) => (
  <Stack className={workflowHandoffActionClassName(className === undefined ? {} : { className })} gap="sm">
    <Stack className={workflowHandoffActionSummaryClassName({})} gap="xs">
      <SemanticText role="pane-title">Workflow handoff</SemanticText>
      {draft === null
        ? (
          <SemanticText role="pane-summary">
            Pin at least one objective or keep a live selection to prepare a workflow draft.
          </SemanticText>
        )
        : (
          <>
            <Badge tone={draft.status === "ready" ? "positive" : "attention"}>{draft.status}</Badge>
            <SemanticText role="pane-summary">{draft.summary}</SemanticText>
          </>
        )}
    </Stack>
    <Button
      disabled={draft === null || onPress === undefined}
      leadingIcon={ArrowTopRightOnSquareIcon}
      onClick={() => {
        if (draft !== null && onPress !== undefined) {
          onPress?.(draft)
        }
      }}
      size="sm"
      tone="primary"
    >
      {draft === null ? "Workflow handoff unavailable" : `Open workflow draft: ${draft.title}`}
    </Button>
  </Stack>
)
