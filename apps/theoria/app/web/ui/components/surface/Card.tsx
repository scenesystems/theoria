import { cardClassName, type CardTone, type SurfacePadding } from "../../recipes/surface.recipe.js"
import { Box, type BoxProps, withClassName } from "../../structure/Box.js"

export type CardProps = BoxProps & {
  readonly padding?: SurfacePadding
  readonly tone?: CardTone
}

export const Card = ({
  className,
  padding = "md",
  tone = "default",
  ...props
}: CardProps) => (
  <Box
    {...props}
    {...withClassName(cardClassName({ padding, tone, ...(className === undefined ? {} : { className }) }))}
  />
)
