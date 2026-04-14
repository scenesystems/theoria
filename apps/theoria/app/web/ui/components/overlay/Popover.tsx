import { XMarkIcon } from "@heroicons/react/24/outline"
import type { ComponentPropsWithRef, ReactNode } from "react"

import { PopoverBehavior } from "../../behavior/PopoverBehavior.js"
import {
  overlayBackdropClassName,
  overlayCloseClassName,
  overlayDescriptionClassName,
  overlayTitleClassName,
  popoverContentClassName
} from "../../recipes/overlay.recipe.js"
import { withClassName } from "../../structure/Box.js"
import { Icon } from "../../structure/Icon.js"
import { VisuallyHidden } from "../../structure/VisuallyHidden.js"

const Root = PopoverBehavior.Root
const Portal = PopoverBehavior.Portal

const Trigger = (
  { children, ...props }: ComponentPropsWithRef<typeof PopoverBehavior.Trigger> & { readonly children?: ReactNode }
) => <PopoverBehavior.Trigger {...props}>{children}</PopoverBehavior.Trigger>

type PopoverBackdropProps = Omit<ComponentPropsWithRef<typeof PopoverBehavior.Backdrop>, "className"> & {
  readonly className?: string
}

type PopoverPositionerProps = Omit<ComponentPropsWithRef<typeof PopoverBehavior.Positioner>, "className"> & {
  readonly className?: string
}

type PopoverContentProps = Omit<ComponentPropsWithRef<typeof PopoverBehavior.Popup>, "className"> & {
  readonly className?: string
}

type PopoverTitleProps = Omit<ComponentPropsWithRef<typeof PopoverBehavior.Title>, "className"> & {
  readonly className?: string
}

type PopoverDescriptionProps = Omit<ComponentPropsWithRef<typeof PopoverBehavior.Description>, "className"> & {
  readonly className?: string
}

type PopoverCloseProps = Omit<ComponentPropsWithRef<typeof PopoverBehavior.Close>, "className"> & {
  readonly children?: ReactNode
  readonly className?: string
}

const Backdrop = ({ className, ...props }: PopoverBackdropProps) => (
  <PopoverBehavior.Backdrop {...props} className={overlayBackdropClassName(withClassName(className))} />
)

const Positioner = ({ className, sideOffset = 10, ...props }: PopoverPositionerProps) => (
  <PopoverBehavior.Positioner {...props} className={className} sideOffset={sideOffset} />
)

const Content = ({ className, ...props }: PopoverContentProps) => (
  <PopoverBehavior.Popup {...props} className={popoverContentClassName(withClassName(className))} />
)

const Title = ({ className, ...props }: PopoverTitleProps) => (
  <PopoverBehavior.Title {...props} className={overlayTitleClassName(withClassName(className))} />
)

const Description = ({ className, ...props }: PopoverDescriptionProps) => (
  <PopoverBehavior.Description {...props} className={overlayDescriptionClassName(withClassName(className))} />
)

const Close = ({ children, className, ...props }: PopoverCloseProps) => (
  <PopoverBehavior.Close {...props} className={overlayCloseClassName(withClassName(className))}>
    {children === undefined ?
      (
        <>
          <Icon size="sm" source={XMarkIcon} />
          <VisuallyHidden>Close popover</VisuallyHidden>
        </>
      ) :
      children}
  </PopoverBehavior.Close>
)

export const Popover = { Root, Trigger, Portal, Backdrop, Positioner, Content, Title, Description, Close }
