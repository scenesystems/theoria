import type { ComponentPropsWithRef, ReactNode } from "react"

import { ButtonBehavior } from "../../behavior/ButtonBehavior.js"
import { buttonClassName, type ButtonSize, type ButtonTone } from "../../recipes/button.recipe.js"
import { withClassName } from "../../structure/Box.js"
import { Icon, type IconSource } from "../../structure/Icon.js"
import { Inline } from "../../structure/Inline.js"
import { SemanticText } from "../../structure/SemanticText.js"

type ButtonProps = Omit<ComponentPropsWithRef<typeof ButtonBehavior>, "children" | "className"> & {
  readonly children: ReactNode
  readonly className?: string
  readonly fullWidth?: boolean
  readonly leadingIcon?: IconSource
  readonly size?: ButtonSize
  readonly tone?: ButtonTone
  readonly trailingIcon?: IconSource
}

const buttonContent = (children: ReactNode): ReactNode =>
  typeof children === "string" ? <SemanticText role="button" tone="inherit">{children}</SemanticText> : children

export const Button = ({
  children,
  className,
  fullWidth = false,
  leadingIcon,
  size = "md",
  tone = "primary",
  trailingIcon,
  ...props
}: ButtonProps) => (
  <ButtonBehavior
    {...props}
    className={buttonClassName({ fullWidth, size, tone, ...withClassName(className) })}
  >
    <Inline align="center" as="span" className="justify-center" gap="sm">
      {leadingIcon === undefined
        ? null
        : <Icon className="text-inherit" size={size === "lg" ? "md" : "sm"} source={leadingIcon} />}
      {buttonContent(children)}
      {trailingIcon === undefined
        ? null
        : <Icon className="text-inherit" size={size === "lg" ? "md" : "sm"} source={trailingIcon} />}
    </Inline>
  </ButtonBehavior>
)
