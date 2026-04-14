import { XMarkIcon } from "@heroicons/react/24/outline"
import type { ComponentPropsWithRef, ReactNode } from "react"

import { DrawerBehavior } from "../../behavior/DrawerBehavior.js"
import {
  drawerContentClassName,
  drawerPopupClassName,
  drawerViewportClassName,
  overlayBackdropClassName,
  overlayCloseClassName,
  overlayDescriptionClassName,
  overlayTitleClassName
} from "../../recipes/overlay.recipe.js"
import { withClassName } from "../../structure/Box.js"
import { Icon } from "../../structure/Icon.js"
import { VisuallyHidden } from "../../structure/VisuallyHidden.js"

const Provider = DrawerBehavior.Provider
const Root = DrawerBehavior.Root
const Portal = DrawerBehavior.Portal
const Trigger = DrawerBehavior.Trigger
const Indent = DrawerBehavior.Indent
const IndentBackground = DrawerBehavior.IndentBackground
const SwipeArea = DrawerBehavior.SwipeArea

type DrawerBackdropProps = Omit<ComponentPropsWithRef<typeof DrawerBehavior.Backdrop>, "className"> & {
  readonly className?: string
}

type DrawerViewportProps = Omit<ComponentPropsWithRef<typeof DrawerBehavior.Viewport>, "className"> & {
  readonly className?: string
}

type DrawerPopupProps = Omit<ComponentPropsWithRef<typeof DrawerBehavior.Popup>, "className"> & {
  readonly className?: string
}

type DrawerContentProps = Omit<ComponentPropsWithRef<typeof DrawerBehavior.Content>, "className"> & {
  readonly className?: string
}

type DrawerTitleProps = Omit<ComponentPropsWithRef<typeof DrawerBehavior.Title>, "className"> & {
  readonly className?: string
}

type DrawerDescriptionProps = Omit<ComponentPropsWithRef<typeof DrawerBehavior.Description>, "className"> & {
  readonly className?: string
}

type DrawerCloseProps = Omit<ComponentPropsWithRef<typeof DrawerBehavior.Close>, "className"> & {
  readonly children?: ReactNode
  readonly className?: string
}

const Backdrop = ({ className, ...props }: DrawerBackdropProps) => (
  <DrawerBehavior.Backdrop {...props} className={overlayBackdropClassName(withClassName(className))} />
)

const Viewport = ({ className, ...props }: DrawerViewportProps) => (
  <DrawerBehavior.Viewport {...props} className={drawerViewportClassName(withClassName(className))} />
)

const Popup = ({ className, ...props }: DrawerPopupProps) => (
  <DrawerBehavior.Popup
    {...props}
    className={(state) =>
      drawerPopupClassName({ swipeDirection: state.swipeDirection, ...(className === undefined ? {} : { className }) })}
  />
)

const Content = ({ className, ...props }: DrawerContentProps) => (
  <DrawerBehavior.Content {...props} className={drawerContentClassName(withClassName(className))} />
)

const Title = ({ className, ...props }: DrawerTitleProps) => (
  <DrawerBehavior.Title {...props} className={overlayTitleClassName(withClassName(className))} />
)

const Description = ({ className, ...props }: DrawerDescriptionProps) => (
  <DrawerBehavior.Description {...props} className={overlayDescriptionClassName(withClassName(className))} />
)

const Close = ({ children, className, ...props }: DrawerCloseProps) => (
  <DrawerBehavior.Close {...props} className={overlayCloseClassName(withClassName(className))}>
    {children === undefined ?
      (
        <>
          <Icon size="sm" source={XMarkIcon} />
          <VisuallyHidden>Close drawer</VisuallyHidden>
        </>
      ) :
      children}
  </DrawerBehavior.Close>
)

export const Drawer = {
  Provider,
  IndentBackground,
  Indent,
  Root,
  Trigger,
  SwipeArea,
  Portal,
  Backdrop,
  Viewport,
  Popup,
  Content,
  Title,
  Description,
  Close
}
