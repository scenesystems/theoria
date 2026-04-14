import type { ComponentPropsWithRef, ReactNode } from "react"

import { buttonClassName, type ButtonSize, type ButtonTone } from "../../recipes/button.recipe.js"
import { withClassName } from "../../structure/Box.js"
import { Icon, type IconSource } from "../../structure/Icon.js"
import { Inline } from "../../structure/Inline.js"
import { Link } from "../../structure/Link.js"
import { SemanticText } from "../../structure/SemanticText.js"

type LinkButtonProps = Omit<ComponentPropsWithRef<"a">, "children" | "className"> & {
  readonly children: ReactNode
  readonly className?: string
  readonly fullWidth?: boolean
  readonly leadingIcon?: IconSource
  readonly size?: ButtonSize
  readonly tone?: ButtonTone
  readonly trailingIcon?: IconSource
}

const linkButtonContent = (children: ReactNode): ReactNode =>
  typeof children === "string" ? <SemanticText role="button" tone="inherit">{children}</SemanticText> : children

export const LinkButton = ({
  children,
  className,
  fullWidth = false,
  leadingIcon,
  size = "md",
  tone = "neutral",
  trailingIcon,
  ...props
}: LinkButtonProps) => (
  <Link
    {...props}
    className={buttonClassName({ fullWidth, size, tone, ...withClassName(className) })}
    tone="inherit"
  >
    <Inline align="center" as="span" className="justify-center" gap="sm">
      {leadingIcon === undefined
        ? null
        : <Icon className="text-inherit" size={size === "lg" ? "md" : "sm"} source={leadingIcon} />}
      {linkButtonContent(children)}
      {trailingIcon === undefined
        ? null
        : <Icon className="text-inherit" size={size === "lg" ? "md" : "sm"} source={trailingIcon} />}
    </Inline>
  </Link>
)
