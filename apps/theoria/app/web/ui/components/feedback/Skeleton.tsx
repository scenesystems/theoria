import { Box, type BoxProps, mergeClassNames } from "../../structure/Box.js"

type SkeletonTone = "default" | "muted"

const skeletonToneClassNames: Record<SkeletonTone, string> = {
  default: "bg-surface-muted/80",
  muted: "bg-surface-muted/55"
}

export type SkeletonProps = BoxProps & {
  readonly tone?: SkeletonTone
}

export const Skeleton = ({ className, tone = "default", ...props }: SkeletonProps) => (
  <Box
    {...props}
    aria-hidden
    className={mergeClassNames(
      "animate-pulse rounded-ui-md",
      skeletonToneClassNames[tone],
      className
    )}
  />
)
