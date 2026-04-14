import { Box, type BoxProps, mergeClassNames } from "./Box.js"

type StackGap = "xs" | "sm" | "md" | "lg" | "xl"
type StackAlign = "start" | "center" | "end" | "stretch"

const stackGapClassNames: Record<StackGap, string> = {
  xs: "gap-1.5",
  sm: "gap-2.5",
  md: "gap-4",
  lg: "gap-6",
  xl: "gap-8"
}

const stackAlignClassNames: Record<StackAlign, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch"
}

export type StackProps = BoxProps & {
  readonly align?: StackAlign
  readonly gap?: StackGap
}

export const Stack = ({
  align = "stretch",
  className,
  gap = "md",
  ...props
}: StackProps) => (
  <Box
    {...props}
    className={mergeClassNames(
      "flex min-w-0 flex-col",
      stackAlignClassNames[align],
      stackGapClassNames[gap],
      className
    )}
  />
)
