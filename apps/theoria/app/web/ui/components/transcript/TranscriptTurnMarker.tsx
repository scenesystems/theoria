import type { ReactNode } from "react"

import { transcriptTurnMarkerBadgeClassName, transcriptTurnMarkerClassName } from "../../recipes/transcript.recipe.js"
import { Box, withClassName } from "../../structure/Box.js"
import { SemanticText } from "../../structure/SemanticText.js"
import { Stack } from "../../structure/Stack.js"

type TranscriptTurnMarkerProps = {
  readonly className?: string
  readonly label: ReactNode
  readonly meta?: ReactNode
}

export const TranscriptTurnMarker = ({ className, label, meta }: TranscriptTurnMarkerProps) => (
  <Stack align="center" className={transcriptTurnMarkerClassName(withClassName(className))} gap="xs">
    <Box as="span" className={transcriptTurnMarkerBadgeClassName({})}>
      {typeof label === "string" || typeof label === "number"
        ? <SemanticText role="strip-label">{label}</SemanticText>
        : label}
    </Box>
    {meta === undefined
      ? null
      : typeof meta === "string" || typeof meta === "number"
      ? <SemanticText role="transcript-meta">{meta}</SemanticText>
      : meta}
  </Stack>
)
