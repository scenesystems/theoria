import type { ComponentPropsWithRef } from "react"

import { mergeClassNames } from "../../structure/Box.js"
import { Toolbar } from "../surface/Toolbar.js"

export type ButtonGroupProps = Omit<ComponentPropsWithRef<typeof Toolbar.Root>, "className"> & {
  readonly className?: string
}

export const ButtonGroup = ({ className, ...props }: ButtonGroupProps) => (
  <Toolbar.Root {...props} className={mergeClassNames("gap-1", className)} />
)
