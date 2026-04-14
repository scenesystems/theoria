import { FlagIcon, PencilSquareIcon, XMarkIcon } from "@heroicons/react/24/outline"
import type { ReactNode } from "react"

import type { TraceSelection } from "../../../../contracts/presentation/interactions.js"
import {
  interactionToolbarActionsClassName,
  interactionToolbarClassName,
  interactionToolbarContextClassName,
  interactionToolbarSummaryClassName
} from "../../recipes/interaction-toolbar.recipe.js"
import { Box } from "../../structure/Box.js"
import { SemanticText } from "../../structure/SemanticText.js"
import { Stack } from "../../structure/Stack.js"
import { Button } from "../action/Button.js"
import { Badge } from "../feedback/Badge.js"
import { WorkspaceActionBar } from "../workspace/WorkspaceActionBar.js"

const selectionKindTone = (kind: TraceSelection["itemKind"]): "neutral" | "info" | "attention" => {
  return kind === "action" ? "attention" : kind === "span" ? "info" : "neutral"
}

type TraceSelectionToolbarProps = {
  readonly className?: string
  readonly onAnnotate?: () => void
  readonly onClearSelection?: () => void
  readonly onPinObjective?: () => void
  readonly selection: TraceSelection | null
  readonly trailing?: ReactNode
}

export const TraceSelectionToolbar = ({
  className,
  onAnnotate,
  onClearSelection,
  onPinObjective,
  selection,
  trailing
}: TraceSelectionToolbarProps) => (
  <WorkspaceActionBar
    className={interactionToolbarClassName(className === undefined ? {} : { className })}
    leading={
      <Stack className={interactionToolbarContextClassName({})} gap="xs">
        <Box className={interactionToolbarSummaryClassName({})}>
          {selection === null
            ? (
              <SemanticText role="pane-meta">
                Select a trace turn, tool call, or span to annotate and pin intent.
              </SemanticText>
            )
            : (
              <>
                <Badge tone={selectionKindTone(selection.itemKind)}>{selection.itemKind}</Badge>
                <SemanticText role="pane-title">{selection.summary}</SemanticText>
              </>
            )}
        </Box>
        {selection === null
          ? null
          : (
            <SemanticText role="pane-meta">
              {selection.quote ?? selection.contextLabel ??
                "Selection is ready for annotation, objective pinning, or agent guidance."}
            </SemanticText>
          )}
      </Stack>
    }
    trailing={
      <Box className={interactionToolbarActionsClassName({})}>
        {selection === null
          ? null
          : (
            <>
              <Button leadingIcon={PencilSquareIcon} onClick={onAnnotate} size="sm" tone="neutral">
                Annotate
              </Button>
              <Button leadingIcon={FlagIcon} onClick={onPinObjective} size="sm" tone="neutral">
                Pin objective
              </Button>
              <Button leadingIcon={XMarkIcon} onClick={onClearSelection} size="sm" tone="ghost">
                Clear
              </Button>
            </>
          )}
        {trailing}
      </Box>
    }
  />
)
