import { XMarkIcon } from "@heroicons/react/24/outline"
import type { ComponentPropsWithRef, ReactNode } from "react"

import { DialogBehavior } from "../../behavior/DialogBehavior.js"
import {
  dialogContentClassName,
  overlayBackdropClassName,
  overlayCloseClassName,
  overlayDescriptionClassName,
  overlayTitleClassName
} from "../../recipes/overlay.recipe.js"
import { withClassName } from "../../structure/Box.js"
import { Icon } from "../../structure/Icon.js"
import { VisuallyHidden } from "../../structure/VisuallyHidden.js"

const Root = DialogBehavior.Root
const Portal = DialogBehavior.Portal

const Trigger = (
  { children, ...props }: ComponentPropsWithRef<typeof DialogBehavior.Trigger> & { readonly children?: ReactNode }
) => <DialogBehavior.Trigger {...props}>{children}</DialogBehavior.Trigger>

type DialogBackdropProps = Omit<ComponentPropsWithRef<typeof DialogBehavior.Backdrop>, "className"> & {
  readonly className?: string
}

type DialogContentProps = Omit<ComponentPropsWithRef<typeof DialogBehavior.Popup>, "className"> & {
  readonly className?: string
}

type DialogTitleProps = Omit<ComponentPropsWithRef<typeof DialogBehavior.Title>, "className"> & {
  readonly className?: string
}

type DialogDescriptionProps = Omit<ComponentPropsWithRef<typeof DialogBehavior.Description>, "className"> & {
  readonly className?: string
}

type DialogCloseProps = Omit<ComponentPropsWithRef<typeof DialogBehavior.Close>, "className"> & {
  readonly children?: ReactNode
  readonly className?: string
}

const Backdrop = ({ className, ...props }: DialogBackdropProps) => (
  <DialogBehavior.Backdrop {...props} className={overlayBackdropClassName(withClassName(className))} />
)

const Content = ({ className, ...props }: DialogContentProps) => (
  <DialogBehavior.Popup {...props} className={dialogContentClassName(withClassName(className))} />
)

const Title = ({ className, ...props }: DialogTitleProps) => (
  <DialogBehavior.Title {...props} className={overlayTitleClassName(withClassName(className))} />
)

const Description = ({ className, ...props }: DialogDescriptionProps) => (
  <DialogBehavior.Description {...props} className={overlayDescriptionClassName(withClassName(className))} />
)

const Close = ({ children, className, ...props }: DialogCloseProps) => (
  <DialogBehavior.Close {...props} className={overlayCloseClassName(withClassName(className))}>
    {children === undefined ?
      (
        <>
          <Icon size="sm" source={XMarkIcon} />
          <VisuallyHidden>Close dialog</VisuallyHidden>
        </>
      ) :
      children}
  </DialogBehavior.Close>
)

export const Dialog = { Root, Trigger, Portal, Backdrop, Content, Title, Description, Close }
