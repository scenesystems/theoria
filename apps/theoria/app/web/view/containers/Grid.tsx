import { Match } from "effect"
import type { ReactNode } from "react"

import type { GridLayout } from "../../../contracts/layout.js"

/**
 * Schema-driven grid container. Maps `GridLayout` variants to
 * Tailwind utility classes — no custom CSS.
 *
 * @since 0.1.0
 */
export const Grid = ({
  children,
  className,
  layout
}: {
  readonly children: ReactNode
  readonly className?: string
  readonly layout: GridLayout
}) => {
  const layoutClass = Match.value(layout).pipe(
    Match.when(
      "lead-rail",
      () => "grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.72fr)] xl:gap-5"
    ),
    Match.when(
      "rail-lead",
      () => "grid grid-cols-1 gap-4 xl:grid-cols-[minmax(20rem,0.72fr)_minmax(0,1.45fr)] xl:gap-5"
    ),
    Match.when("split", () => "grid grid-cols-1 gap-4 xl:grid-cols-2 xl:gap-5"),
    Match.when("sidebar", () => "grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.35fr)_minmax(0,1fr)] xl:gap-5"),
    Match.orElse(() => "grid grid-cols-1 gap-4")
  )

  const combined = className === undefined
    ? layoutClass
    : `${layoutClass} ${className}`

  return <div className={combined}>{children}</div>
}
