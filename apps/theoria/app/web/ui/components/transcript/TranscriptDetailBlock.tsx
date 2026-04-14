import type { ReactNode } from "react"

import { transcriptDetailBlockClassName } from "../../recipes/transcript.recipe.js"
import { Box, withClassName } from "../../structure/Box.js"
import { SemanticText } from "../../structure/SemanticText.js"
import { Stack } from "../../structure/Stack.js"

type TranscriptDetailBlockProps = {
  readonly children: ReactNode
  readonly className?: string
  readonly label?: ReactNode
  readonly meta?: ReactNode
}

export const TranscriptDetailBlock = ({ children, className, label, meta }: TranscriptDetailBlockProps) => (
  <Box className={transcriptDetailBlockClassName(withClassName(className))}>
    <Stack gap="sm">
      {label === undefined
        ? null
        : typeof label === "string" || typeof label === "number"
        ? <SemanticText role="detail-label">{label}</SemanticText>
        : label}
      {meta === undefined
        ? null
        : typeof meta === "string" || typeof meta === "number"
        ? <SemanticText role="transcript-meta">{meta}</SemanticText>
        : meta}
      {children}
    </Stack>
  </Box>
)
