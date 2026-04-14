import type { ComponentPropsWithRef, ReactNode } from "react"

import { TooltipBehavior } from "../../behavior/TooltipBehavior.js"
import { tooltipContentClassName } from "../../recipes/overlay.recipe.js"
import { withClassName } from "../../structure/Box.js"
import { SemanticText } from "../../structure/SemanticText.js"

const Provider = TooltipBehavior.Provider
const Root = TooltipBehavior.Root
const Portal = TooltipBehavior.Portal
const Trigger = TooltipBehavior.Trigger

type TooltipPositionerProps = Omit<ComponentPropsWithRef<typeof TooltipBehavior.Positioner>, "className"> & {
  readonly className?: string
}

type TooltipContentProps = Omit<ComponentPropsWithRef<typeof TooltipBehavior.Popup>, "children" | "className"> & {
  readonly children: ReactNode
  readonly className?: string
}

const Positioner = ({ className, sideOffset = 6, ...props }: TooltipPositionerProps) => (
  <TooltipBehavior.Positioner {...props} className={className} sideOffset={sideOffset} />
)

const tooltipContent = (children: ReactNode): ReactNode =>
  typeof children === "string" ? <SemanticText role="body-sm" tone="inherit">{children}</SemanticText> : children

const Content = ({ children, className, ...props }: TooltipContentProps) => (
  <TooltipBehavior.Popup {...props} className={tooltipContentClassName(withClassName(className))}>
    {tooltipContent(children)}
  </TooltipBehavior.Popup>
)

export const Tooltip = { Provider, Root, Trigger, Portal, Positioner, Content }
