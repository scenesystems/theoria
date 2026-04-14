import { transcriptRailClassName } from "../../recipes/transcript.recipe.js"
import { Box, type BoxProps, withClassName } from "../../structure/Box.js"

export const TranscriptRail = ({ className, ...props }: BoxProps) => (
  <Box {...props} className={transcriptRailClassName(withClassName(className))} />
)
