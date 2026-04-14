import type { ReactNode } from "react"

import type { TraceAnnotationKind, TraceSelection } from "../../../../contracts/presentation/interactions.js"
import {
  traceAnnotationComposerClassName,
  traceAnnotationKindButtonClassName,
  traceAnnotationKindListClassName
} from "../../recipes/annotation.recipe.js"
import { Box } from "../../structure/Box.js"
import { SemanticText } from "../../structure/SemanticText.js"
import { Stack } from "../../structure/Stack.js"
import { Button } from "../action/Button.js"
import { TextAreaField } from "../form/TextAreaField.js"
import { TextField } from "../form/TextField.js"

const annotationKinds: ReadonlyArray<TraceAnnotationKind> = ["note", "finding", "objective", "question", "risk"]

type TraceAnnotationComposerProps = {
  readonly className?: string
  readonly createLabel?: ReactNode
  readonly kind: TraceAnnotationKind
  readonly label: string
  readonly note: string
  readonly onCancel?: () => void
  readonly onCreate?: () => void
  readonly onKindChange?: (kind: TraceAnnotationKind) => void
  readonly onLabelChange?: (value: string) => void
  readonly onNoteChange?: (value: string) => void
  readonly selection: TraceSelection | null
}

export const TraceAnnotationComposer = ({
  className,
  createLabel = "Create annotation",
  kind,
  label,
  note,
  onCancel,
  onCreate,
  onKindChange,
  onLabelChange,
  onNoteChange,
  selection
}: TraceAnnotationComposerProps) => (
  <Stack className={traceAnnotationComposerClassName(className === undefined ? {} : { className })} gap="md">
    <Stack gap="xs">
      <SemanticText role="pane-title">Trace annotation</SemanticText>
      <SemanticText role="pane-summary">
        {selection === null
          ? "Annotations become durable study observations once a trace selection is active."
          : selection.quote ?? selection.summary}
      </SemanticText>
    </Stack>
    <Box className={traceAnnotationKindListClassName({})}>
      {annotationKinds.map((annotationKind) => (
        <Button
          className={traceAnnotationKindButtonClassName({ selected: kind === annotationKind })}
          key={annotationKind}
          onClick={() => onKindChange?.(annotationKind)}
          size="sm"
          tone="ghost"
        >
          {annotationKind}
        </Button>
      ))}
    </Box>
    <TextField label="Annotation label" onValueChange={onLabelChange} value={label} />
    <TextAreaField
      hint="Capture the failure mode, opportunity, or question you want to preserve from the trace."
      label="Annotation note"
      onValueChange={onNoteChange}
      rows={4}
      value={note}
    />
    <Box className="flex min-w-0 flex-wrap items-center justify-end gap-2">
      <Button onClick={onCancel} size="sm" tone="ghost">
        Cancel
      </Button>
      <Button onClick={onCreate} size="sm" tone="primary">
        {createLabel}
      </Button>
    </Box>
  </Stack>
)
