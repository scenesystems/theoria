import type { ComponentPropsWithRef } from "react"

import { ButtonBehavior } from "../../behavior/ButtonBehavior.js"
import { iconButtonClassName, type IconButtonSize, type IconButtonTone } from "../../recipes/icon-button.recipe.js"
import { withClassName } from "../../structure/Box.js"
import { Icon, type IconSource } from "../../structure/Icon.js"

type IconButtonProps = Omit<ComponentPropsWithRef<typeof ButtonBehavior>, "children" | "className" | "aria-label"> & {
  readonly className?: string
  readonly label: string
  readonly size?: IconButtonSize
  readonly source: IconSource
  readonly tone?: IconButtonTone
}

export const IconButton = ({ className, label, size = "md", source, tone = "ghost", ...props }: IconButtonProps) => (
  <ButtonBehavior
    {...props}
    aria-label={label}
    className={iconButtonClassName({ size, tone, ...withClassName(className) })}
  >
    <Icon className="text-inherit" size={size === "lg" ? "md" : "sm"} source={source} />
  </ButtonBehavior>
)
