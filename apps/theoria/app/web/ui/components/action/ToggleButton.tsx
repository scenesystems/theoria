import type { ComponentPropsWithRef, ReactNode } from "react"

import { ToggleBehavior } from "../../behavior/ToggleBehavior.js"
import { buttonClassName, type ButtonSize, type ButtonTone } from "../../recipes/button.recipe.js"
import { mergeClassNames, withClassName } from "../../structure/Box.js"
import { Icon, type IconSource } from "../../structure/Icon.js"
import { Inline } from "../../structure/Inline.js"
import { SemanticText } from "../../structure/SemanticText.js"

const toggleButtonToneClassNames: Record<ButtonTone, string> = {
  primary: "data-[pressed]:border-content-secondary data-[pressed]:bg-content-secondary data-[pressed]:shadow-none",
  neutral:
    "data-[pressed]:border-content-subtle data-[pressed]:bg-surface-canvas data-[pressed]:text-content-primary data-[pressed]:shadow-none",
  danger: "data-[pressed]:border-danger-700 data-[pressed]:bg-danger-700 data-[pressed]:shadow-none",
  ghost:
    "data-[pressed]:border-border-muted data-[pressed]:bg-surface-panel/92 data-[pressed]:text-content-primary data-[pressed]:shadow-none"
}

type ToggleButtonProps = Omit<ComponentPropsWithRef<typeof ToggleBehavior>, "children" | "className"> & {
  readonly children: ReactNode
  readonly className?: string
  readonly fullWidth?: boolean
  readonly leadingIcon?: IconSource
  readonly size?: ButtonSize
  readonly tone?: ButtonTone
  readonly trailingIcon?: IconSource
}

const toggleButtonContent = (children: ReactNode): ReactNode =>
  typeof children === "string" ? <SemanticText role="button" tone="inherit">{children}</SemanticText> : children

export const ToggleButton = ({
  children,
  className,
  fullWidth = false,
  leadingIcon,
  size = "md",
  tone = "neutral",
  trailingIcon,
  ...props
}: ToggleButtonProps) => (
  <ToggleBehavior
    {...props}
    className={mergeClassNames(
      buttonClassName({ fullWidth, size, tone, ...withClassName(className) }),
      toggleButtonToneClassNames[tone]
    )}
  >
    <Inline align="center" as="span" className="justify-center" gap="sm">
      {leadingIcon === undefined
        ? null
        : <Icon className="text-inherit" size={size === "lg" ? "md" : "sm"} source={leadingIcon} />}
      {toggleButtonContent(children)}
      {trailingIcon === undefined
        ? null
        : <Icon className="text-inherit" size={size === "lg" ? "md" : "sm"} source={trailingIcon} />}
    </Inline>
  </ToggleBehavior>
)
