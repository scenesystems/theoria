import type { ReactNode } from "react"

import {
  type TranscriptAlignment,
  transcriptBubbleShellClassName,
  transcriptRowClassName
} from "../../recipes/transcript.recipe.js"
import { Box, withClassName } from "../../structure/Box.js"

type TranscriptRowProps = {
  readonly align?: TranscriptAlignment
  readonly children: ReactNode
  readonly className?: string
  readonly leading?: ReactNode
}

export const TranscriptRow = ({ align = "start", children, className, leading }: TranscriptRowProps) => (
  <Box className={transcriptRowClassName({ align, ...withClassName(className) })}>
    <Box className={transcriptBubbleShellClassName({ align })}>
      {leading}
      {children}
    </Box>
  </Box>
)
