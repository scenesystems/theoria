import { Box, type BoxProps, mergeClassNames } from "./Box.js"

type InlineGap = "xs" | "sm" | "md" | "lg"
type InlineAlign = "start" | "center" | "end"

const inlineGapClassNames: Record<InlineGap, string> = {
  xs: "gap-1.5",
  sm: "gap-2",
  md: "gap-3",
  lg: "gap-4"
}

const inlineAlignClassNames: Record<InlineAlign, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end"
}

export type InlineProps = BoxProps & {
  readonly align?: InlineAlign
  readonly gap?: InlineGap
  readonly wrap?: boolean
}

export const Inline = ({
  align = "center",
  className,
  gap = "sm",
  wrap = false,
  ...props
}: InlineProps) => (
  <Box
    {...props}
    className={mergeClassNames(
      "flex min-w-0 flex-row",
      inlineAlignClassNames[align],
      inlineGapClassNames[gap],
      wrap ? "flex-wrap" : "flex-nowrap",
      className
    )}
  />
)
