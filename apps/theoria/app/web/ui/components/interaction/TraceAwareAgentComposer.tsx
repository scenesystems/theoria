import type { ReactNode } from "react"

import type { InteractionComposerContext } from "../../../../contracts/presentation/interactions.js"
import {
  traceAwareAgentComposerClassName,
  traceAwareAgentContextClassName,
  traceAwareAgentPromptClassName,
  traceAwareAgentSummaryListClassName
} from "../../recipes/composer-context.recipe.js"
import { Box } from "../../structure/Box.js"
import { SemanticText } from "../../structure/SemanticText.js"
import { Stack } from "../../structure/Stack.js"
import { Button } from "../action/Button.js"
import { Badge } from "../feedback/Badge.js"
import { TextAreaField } from "../form/TextAreaField.js"

type TraceAwareAgentComposerProps = {
  readonly className?: string
  readonly composerContext: InteractionComposerContext
  readonly onReset?: () => void
  readonly onSubmit?: () => void
  readonly onValueChange?: (value: string) => void
  readonly submitLabel?: ReactNode
  readonly value: string
}

export const TraceAwareAgentComposer = ({
  className,
  composerContext,
  onReset,
  onSubmit,
  onValueChange,
  submitLabel = "Ask the agent",
  value
}: TraceAwareAgentComposerProps) => (
  <Stack className={traceAwareAgentComposerClassName(className === undefined ? {} : { className })} gap="md">
    <Box className={traceAwareAgentContextClassName({})}>
      <Stack gap="xs">
        <SemanticText role="pane-title">Trace-aware agent composer</SemanticText>
        <SemanticText role="pane-summary">{composerContext.summary}</SemanticText>
        <Box className={traceAwareAgentSummaryListClassName({})}>
          {composerContext.selection === null ? null : <Badge tone="info">selection</Badge>}
          {composerContext.annotations.length === 0
            ? null
            : (
              <Badge tone="attention">
                {`${composerContext.annotations.length} annotation${
                  composerContext.annotations.length === 1 ? "" : "s"
                }`}
              </Badge>
            )}
          {composerContext.pinnedObjectives.length === 0
            ? null
            : (
              <Badge tone="positive">
                {`${composerContext.pinnedObjectives.length} objective${
                  composerContext.pinnedObjectives.length === 1 ? "" : "s"
                }`}
              </Badge>
            )}
        </Box>
      </Stack>
    </Box>
    <TextAreaField
      hint={composerContext.suggestedPrompt ??
        "Ask the agent to convert this trace context into a stronger workflow or explanation."}
      label="Prompt"
      onValueChange={onValueChange}
      rows={4}
      value={value}
    />
    <Box
      className={traceAwareAgentPromptClassName({ className: "flex min-w-0 flex-wrap items-center justify-end gap-2" })}
    >
      <Button onClick={onReset} size="sm" tone="ghost">
        Reset
      </Button>
      <Button onClick={onSubmit} size="sm" tone="primary">
        {submitLabel}
      </Button>
    </Box>
  </Stack>
)
