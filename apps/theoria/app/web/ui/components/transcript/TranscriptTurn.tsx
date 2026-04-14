import type { ReactNode } from "react"

import { transcriptTurnClassName, transcriptTurnStackClassName } from "../../recipes/transcript.recipe.js"
import { Box, withClassName } from "../../structure/Box.js"

import { TranscriptRail } from "./TranscriptRail.js"

type TranscriptTurnProps = {
  readonly children: ReactNode
  readonly className?: string
  readonly marker: ReactNode
}

export const TranscriptTurn = ({ children, className, marker }: TranscriptTurnProps) => (
  <Box className={transcriptTurnClassName(withClassName(className))}>
    <TranscriptRail>{marker}</TranscriptRail>
    <Box className={transcriptTurnStackClassName({})}>{children}</Box>
  </Box>
)
