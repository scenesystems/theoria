import type { ComponentPropsWithRef } from "react"

import { mergeClassNames } from "./Box.js"

type LinkTone = "primary" | "muted" | "inherit"

const linkToneClassNames: Record<LinkTone, string> = {
  primary: "text-accent-solid hover:text-tone-text-800",
  muted: "text-content-muted hover:text-content-primary",
  inherit: ""
}

export type LinkProps = ComponentPropsWithRef<"a"> & {
  readonly tone?: LinkTone
}

export const Link = ({ className, tone = "primary", ...props }: LinkProps) => (
  <a
    {...props}
    className={mergeClassNames(
      "min-w-0 transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2",
      linkToneClassNames[tone],
      className
    )}
  />
)
