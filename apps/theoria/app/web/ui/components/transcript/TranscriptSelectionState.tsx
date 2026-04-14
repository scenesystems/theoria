import type { ReactNode } from "react"

import { transcriptSelectionStateClassName } from "../../recipes/transcript.recipe.js"
import { Box, withClassName } from "../../structure/Box.js"
import { SemanticText } from "../../structure/SemanticText.js"

type TranscriptSelectionStateProps = {
  readonly active?: boolean
  readonly className?: string
  readonly label: ReactNode
}

export const TranscriptSelectionState = ({
  active = true,
  className,
  label
}: TranscriptSelectionStateProps) => (
  <Box as="span" className={transcriptSelectionStateClassName({ active, ...withClassName(className) })}>
    {typeof label === "string" || typeof label === "number"
      ? <SemanticText role="pane-meta" tone="inherit">{label}</SemanticText>
      : label}
  </Box>
)
