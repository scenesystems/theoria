import { Box, type BoxProps, mergeClassNames } from "./Box.js"

type ScrollDirection = "vertical" | "horizontal" | "both"

const scrollDirectionClassNames: Record<ScrollDirection, string> = {
  vertical: "overflow-y-auto overflow-x-hidden",
  horizontal: "overflow-x-auto overflow-y-hidden",
  both: "overflow-auto"
}

export type ScrollRegionProps = BoxProps & {
  readonly direction?: ScrollDirection
}

export const ScrollRegion = ({
  className,
  direction = "vertical",
  ...props
}: ScrollRegionProps) => (
  <Box
    {...props}
    className={mergeClassNames("min-h-0 overscroll-contain", scrollDirectionClassNames[direction], className)}
  />
)
