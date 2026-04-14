import { Box, type BoxProps, mergeClassNames } from "./Box.js"

type GridColumns = 1 | 2 | 3 | 4
type GridGap = "sm" | "md" | "lg"

const gridColumnClassNames: Record<GridColumns, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 lg:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
  4: "grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
}

const gridGapClassNames: Record<GridGap, string> = {
  sm: "gap-3",
  md: "gap-4",
  lg: "gap-6"
}

export type GridProps = BoxProps & {
  readonly columns?: GridColumns
  readonly gap?: GridGap
}

export const Grid = ({
  className,
  columns = 1,
  gap = "md",
  ...props
}: GridProps) => (
  <Box
    {...props}
    className={mergeClassNames("grid min-w-0", gridColumnClassNames[columns], gridGapClassNames[gap], className)}
  />
)
