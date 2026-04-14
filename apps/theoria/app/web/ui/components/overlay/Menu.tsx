import type { ComponentPropsWithRef, ReactNode } from "react"

import { MenuBehavior } from "../../behavior/MenuBehavior.js"
import {
  menuContentClassName,
  menuGroupClassName,
  menuGroupLabelClassName,
  menuItemClassName,
  menuPositionerClassName,
  menuSeparatorClassName,
  menuViewportClassName,
  overlayBackdropClassName
} from "../../recipes/overlay.recipe.js"
import { withClassName } from "../../structure/Box.js"
import { SemanticText } from "../../structure/SemanticText.js"

const Root = MenuBehavior.Root
const Portal = MenuBehavior.Portal
const Trigger = MenuBehavior.Trigger

type MenuBackdropProps = Omit<ComponentPropsWithRef<typeof MenuBehavior.Backdrop>, "className"> & {
  readonly className?: string
}

type MenuPositionerProps = Omit<ComponentPropsWithRef<typeof MenuBehavior.Positioner>, "className"> & {
  readonly className?: string
}

type MenuContentProps = Omit<ComponentPropsWithRef<typeof MenuBehavior.Popup>, "className"> & {
  readonly className?: string
}

type MenuViewportProps = Omit<ComponentPropsWithRef<typeof MenuBehavior.Viewport>, "className"> & {
  readonly className?: string
}

type MenuItemProps = Omit<ComponentPropsWithRef<typeof MenuBehavior.Item>, "children" | "className"> & {
  readonly children: ReactNode
  readonly className?: string
}

type MenuGroupProps = Omit<ComponentPropsWithRef<typeof MenuBehavior.Group>, "className"> & {
  readonly className?: string
}

type MenuGroupLabelProps = Omit<ComponentPropsWithRef<typeof MenuBehavior.GroupLabel>, "children" | "className"> & {
  readonly children: ReactNode
  readonly className?: string
}

type MenuSeparatorProps = Omit<ComponentPropsWithRef<typeof MenuBehavior.Separator>, "className"> & {
  readonly className?: string
}

const menuItemContent = (children: ReactNode): ReactNode =>
  typeof children === "string" ? <SemanticText role="body" tone="inherit">{children}</SemanticText> : children

const groupLabelContent = (children: ReactNode): ReactNode =>
  typeof children === "string" ? <SemanticText role="label" tone="inherit">{children}</SemanticText> : children

const Backdrop = ({ className, ...props }: MenuBackdropProps) => (
  <MenuBehavior.Backdrop {...props} className={overlayBackdropClassName(withClassName(className))} />
)

const Positioner = ({ className, sideOffset = 8, ...props }: MenuPositionerProps) => (
  <MenuBehavior.Positioner
    {...props}
    className={menuPositionerClassName(withClassName(className))}
    sideOffset={sideOffset}
  />
)

const Content = ({ className, ...props }: MenuContentProps) => (
  <MenuBehavior.Popup {...props} className={menuContentClassName(withClassName(className))} />
)

const Viewport = ({ className, ...props }: MenuViewportProps) => (
  <MenuBehavior.Viewport {...props} className={menuViewportClassName(withClassName(className))} />
)

const Item = ({ children, className, ...props }: MenuItemProps) => (
  <MenuBehavior.Item {...props} className={menuItemClassName(withClassName(className))}>
    {menuItemContent(children)}
  </MenuBehavior.Item>
)

const Group = ({ className, ...props }: MenuGroupProps) => (
  <MenuBehavior.Group {...props} className={menuGroupClassName(withClassName(className))} />
)

const GroupLabel = ({ children, className, ...props }: MenuGroupLabelProps) => (
  <MenuBehavior.GroupLabel {...props} className={menuGroupLabelClassName(withClassName(className))}>
    {groupLabelContent(children)}
  </MenuBehavior.GroupLabel>
)

const Separator = ({ className, ...props }: MenuSeparatorProps) => (
  <MenuBehavior.Separator {...props} className={menuSeparatorClassName(withClassName(className))} />
)

export const Menu = {
  Root,
  Trigger,
  Portal,
  Backdrop,
  Positioner,
  Content,
  Viewport,
  Item,
  Group,
  GroupLabel,
  Separator
}
