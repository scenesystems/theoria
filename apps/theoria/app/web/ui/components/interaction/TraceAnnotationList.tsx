import type { ReactNode } from "react"

import type { TraceAnnotation } from "../../../../contracts/presentation/interactions.js"
import {
  traceAnnotationCardClassName,
  traceAnnotationListClassName,
  traceAnnotationMetaClassName,
  traceAnnotationSelectionClassName
} from "../../recipes/annotation.recipe.js"
import { Box } from "../../structure/Box.js"
import { SemanticText } from "../../structure/SemanticText.js"
import { Stack } from "../../structure/Stack.js"
import { Button } from "../action/Button.js"
import { Badge } from "../feedback/Badge.js"

const annotationTone = (annotation: TraceAnnotation): "neutral" | "info" | "attention" | "danger" => {
  return annotation.tone === "info"
    ? "info"
    : annotation.tone === "attention"
    ? "attention"
    : annotation.tone === "danger"
    ? "danger"
    : "neutral"
}

type TraceAnnotationListProps = {
  readonly className?: string
  readonly emptyText?: ReactNode
  readonly onPinObjective?: (annotation: TraceAnnotation) => void
  readonly onRemove?: (annotationId: string) => void
  readonly onSelect?: (annotationId: string) => void
  readonly selectedAnnotationId?: string | null
  readonly traceAnnotations: ReadonlyArray<TraceAnnotation>
}

export const TraceAnnotationList = ({
  className,
  emptyText = "No annotations yet. Select a trace moment and capture what matters.",
  onPinObjective,
  onRemove,
  onSelect,
  selectedAnnotationId = null,
  traceAnnotations
}: TraceAnnotationListProps) =>
  traceAnnotations.length === 0
    ? <SemanticText role="pane-meta">{emptyText}</SemanticText>
    : (
      <Box className={traceAnnotationListClassName(className === undefined ? {} : { className })}>
        {traceAnnotations.map((annotation) => (
          <Stack
            className={traceAnnotationCardClassName({ selected: selectedAnnotationId === annotation.id })}
            gap="sm"
            key={annotation.id}
          >
            <Box className={traceAnnotationMetaClassName({})}>
              <Box className="flex min-w-0 flex-wrap items-center gap-2">
                <Badge tone={annotationTone(annotation)}>{annotation.kind}</Badge>
                <SemanticText role="pane-title">{annotation.label}</SemanticText>
              </Box>
              <Box className="flex min-w-0 flex-wrap items-center gap-2">
                <Button onClick={() => onSelect?.(annotation.id)} size="sm" tone="ghost">
                  Focus
                </Button>
                <Button onClick={() => onPinObjective?.(annotation)} size="sm" tone="ghost">
                  Pin objective
                </Button>
                <Button onClick={() => onRemove?.(annotation.id)} size="sm" tone="ghost">
                  Remove
                </Button>
              </Box>
            </Box>
            <Box className={traceAnnotationSelectionClassName({})}>
              <SemanticText role="pane-meta">{annotation.selection.summary}</SemanticText>
            </Box>
            {annotation.note === null ? null : <SemanticText role="detail-value">{annotation.note}</SemanticText>}
          </Stack>
        ))}
      </Box>
    )
