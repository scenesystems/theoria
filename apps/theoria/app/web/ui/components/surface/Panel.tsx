import { panelClassName, type PanelPadding, type PanelTone } from "../../recipes/panel.recipe.js"
import { Box, type BoxProps, withClassName } from "../../structure/Box.js"

export type PanelProps = BoxProps & {
  readonly padding?: PanelPadding
  readonly tone?: PanelTone
}

export const Panel = ({
  className,
  padding = "md",
  tone = "default",
  ...props
}: PanelProps) => (
  <Box
    {...props}
    {...withClassName(panelClassName({ padding, tone, ...(className === undefined ? {} : { className }) }))}
  />
)
