import { cn } from "../structure/Box.js"

export type WorkspaceRailLayoutWidth = "sm" | "md" | "lg"

const workspaceRailLayoutWidthClassNames: Record<WorkspaceRailLayoutWidth, string> = {
  sm: "xl:grid-cols-[13rem_minmax(0,1fr)]",
  md: "xl:grid-cols-[15rem_minmax(0,1fr)]",
  lg: "xl:grid-cols-[18rem_minmax(0,1fr)]"
}

export const workspaceRailLayoutClassName = ({
  className,
  width
}: {
  readonly className?: string
  readonly width: WorkspaceRailLayoutWidth
}): string =>
  cn(
    "grid min-h-0 min-w-0 grid-cols-1",
    workspaceRailLayoutWidthClassNames[width],
    className
  )

export const workspaceRailLayoutRailClassName = ({
  className,
  sticky
}: {
  readonly className?: string
  readonly sticky: boolean
}): string =>
  cn(
    "min-w-0 xl:border-r xl:border-border-pane xl:pr-6",
    sticky ? "xl:sticky xl:top-0 xl:self-start" : undefined,
    className
  )

export const workspaceRailLayoutContentClassName = ({ className }: { readonly className?: string }): string =>
  cn("min-w-0 xl:pl-6", className)
