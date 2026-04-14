import type { ComponentPropsWithRef, ElementType } from "react"

import { mergeClassNames } from "./Box.js"

export type IconSource = ElementType<ComponentPropsWithRef<"svg">>
type IconSize = "xs" | "sm" | "md" | "lg"

const iconSizeClassNames: Record<IconSize, string> = {
  xs: "size-3.5",
  sm: "size-4",
  md: "size-5",
  lg: "size-6"
}

export type IconProps = {
  readonly className?: string
  readonly decorative?: boolean
  readonly size?: IconSize
  readonly source: IconSource
}

export const Icon = ({ className, decorative = true, size = "md", source: Source }: IconProps) => (
  <Source aria-hidden={decorative} className={mergeClassNames("shrink-0", iconSizeClassNames[size], className)} />
)
