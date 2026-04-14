import { sheetClassName, type SheetTone, type SurfacePadding } from "../../recipes/surface.recipe.js"
import { Box, type BoxProps, withClassName } from "../../structure/Box.js"

export type SheetProps = BoxProps & {
  readonly padding?: SurfacePadding
  readonly tone?: SheetTone
}

export const Sheet = ({
  className,
  padding = "md",
  tone = "default",
  ...props
}: SheetProps) => (
  <Box
    {...props}
    {...withClassName(sheetClassName({ padding, tone, ...(className === undefined ? {} : { className }) }))}
  />
)
