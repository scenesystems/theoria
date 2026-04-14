import type { ComponentPropsWithRef } from "react"

import { SeparatorBehavior } from "../behavior/SeparatorBehavior.js"
import { mergeClassNames } from "./Box.js"

type DividerProps = ComponentPropsWithRef<typeof SeparatorBehavior> & {
  readonly inset?: boolean
}

export const Divider = ({ className, inset = false, orientation = "horizontal", ...props }: DividerProps) => (
  <SeparatorBehavior
    {...props}
    className={mergeClassNames(
      orientation === "vertical" ? "h-full w-px self-stretch" : "h-px w-full",
      inset ? "mx-4" : undefined,
      "bg-border-muted",
      typeof className === "string" ? className : undefined
    )}
    orientation={orientation}
  />
)
