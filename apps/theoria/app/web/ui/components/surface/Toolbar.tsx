import type { ComponentPropsWithRef } from "react"

import { ToolbarBehavior } from "../../behavior/ToolbarBehavior.js"
import { toolbarClassName } from "../../recipes/toolbar.recipe.js"
import { cn, withClassName } from "../../structure/Box.js"

type ToolbarRootProps = Omit<ComponentPropsWithRef<typeof ToolbarBehavior.Root>, "className"> & {
  readonly className?: string
}

type ToolbarGroupProps = Omit<ComponentPropsWithRef<typeof ToolbarBehavior.Group>, "className"> & {
  readonly className?: string
}

type ToolbarSeparatorProps = Omit<ComponentPropsWithRef<typeof ToolbarBehavior.Separator>, "className"> & {
  readonly className?: string
}

const Root = ({ className, ...props }: ToolbarRootProps) => (
  <ToolbarBehavior.Root {...props} className={toolbarClassName(withClassName(className))} />
)

const Group = ({ className, ...props }: ToolbarGroupProps) => (
  <ToolbarBehavior.Group
    {...props}
    className={cn("inline-flex min-w-0 items-center gap-1.5", className)}
  />
)

const Separator = ({
  className,
  orientation = "vertical",
  ...props
}: ToolbarSeparatorProps) => (
  <ToolbarBehavior.Separator
    {...props}
    className={cn(
      orientation === "vertical" ? "h-5 w-px self-stretch" : "h-px w-full",
      "bg-border-muted",
      className
    )}
    orientation={orientation}
  />
)

export const Toolbar = { Root, Group, Separator }
