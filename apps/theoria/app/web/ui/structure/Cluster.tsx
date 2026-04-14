import { Box, type BoxProps, mergeClassNames } from "./Box.js"

type ClusterGap = "xs" | "sm" | "md" | "lg"
type ClusterJustify = "start" | "between" | "end"

const clusterGapClassNames: Record<ClusterGap, string> = {
  xs: "gap-1.5",
  sm: "gap-2.5",
  md: "gap-4",
  lg: "gap-6"
}

const clusterJustifyClassNames: Record<ClusterJustify, string> = {
  start: "justify-start",
  between: "justify-between",
  end: "justify-end"
}

export type ClusterProps = BoxProps & {
  readonly gap?: ClusterGap
  readonly justify?: ClusterJustify
}

export const Cluster = ({
  className,
  gap = "md",
  justify = "start",
  ...props
}: ClusterProps) => (
  <Box
    {...props}
    className={mergeClassNames(
      "flex min-w-0 flex-wrap items-center",
      clusterGapClassNames[gap],
      clusterJustifyClassNames[justify],
      className
    )}
  />
)
