import type { ComponentPropsWithRef } from "react"

export type VisuallyHiddenProps = ComponentPropsWithRef<"span">

export const VisuallyHidden = ({ className, ...props }: VisuallyHiddenProps) => (
  <span {...props} className={["sr-only", className].filter(Boolean).join(" ")} />
)
