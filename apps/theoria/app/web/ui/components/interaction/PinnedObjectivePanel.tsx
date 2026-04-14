import type { ReactNode } from "react"

import type { PinnedObjective } from "../../../../contracts/presentation/interactions.js"
import {
  pinnedObjectiveCardClassName,
  pinnedObjectiveContextClassName,
  pinnedObjectiveHeaderClassName,
  pinnedObjectiveListClassName,
  pinnedObjectivePanelClassName
} from "../../recipes/pinned-objective.recipe.js"
import { Box } from "../../structure/Box.js"
import { SemanticText } from "../../structure/SemanticText.js"
import { Stack } from "../../structure/Stack.js"
import { Button } from "../action/Button.js"
import { Badge } from "../feedback/Badge.js"

const objectiveTone = (status: PinnedObjective["status"]): "neutral" | "attention" | "positive" => {
  return status === "handoff-ready" ? "positive" : status === "active" ? "attention" : "neutral"
}

type PinnedObjectivePanelProps = {
  readonly className?: string
  readonly emptyText?: ReactNode
  readonly objectives: ReadonlyArray<PinnedObjective>
  readonly onPrepareWorkflow?: (objective: PinnedObjective) => void
  readonly onRemove?: (objectiveId: string) => void
}

export const PinnedObjectivePanel = ({
  className,
  emptyText = "Pinned objectives keep the interaction workspace grounded in what should change.",
  objectives,
  onPrepareWorkflow,
  onRemove
}: PinnedObjectivePanelProps) => (
  <Stack className={pinnedObjectivePanelClassName(className === undefined ? {} : { className })} gap="md">
    <Stack gap="xs">
      <SemanticText role="pane-title">Pinned objectives</SemanticText>
      <SemanticText role="pane-summary">
        Keep explicit study intent visible while you annotate and collaborate with the agent.
      </SemanticText>
    </Stack>
    {objectives.length === 0
      ? <SemanticText role="pane-meta">{emptyText}</SemanticText>
      : (
        <Box className={pinnedObjectiveListClassName({})}>
          {objectives.map((objective) => (
            <Stack className={pinnedObjectiveCardClassName({})} gap="sm" key={objective.id}>
              <Box className={pinnedObjectiveHeaderClassName({})}>
                <Box className="flex min-w-0 flex-wrap items-center gap-2">
                  <Badge tone={objectiveTone(objective.status)}>{objective.status}</Badge>
                  <SemanticText role="pane-title">{objective.title}</SemanticText>
                </Box>
                <Box className="flex min-w-0 flex-wrap items-center gap-2">
                  <Button
                    onClick={() =>
                      onPrepareWorkflow?.(objective)}
                    size="sm"
                    tone="ghost"
                  >
                    Prepare workflow
                  </Button>
                  <Button
                    onClick={() =>
                      onRemove?.(objective.id)}
                    size="sm"
                    tone="ghost"
                  >
                    Remove
                  </Button>
                </Box>
              </Box>
              <SemanticText role="detail-value">{objective.summary}</SemanticText>
              <Box className={pinnedObjectiveContextClassName({})}>
                <SemanticText role="pane-meta">{objective.selection.summary}</SemanticText>
              </Box>
            </Stack>
          ))}
        </Box>
      )}
  </Stack>
)
