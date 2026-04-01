import { Match } from "effect"
import type { ReactNode } from "react"

import type { ContentCardDensity } from "../../../contracts/layout.js"

import type { ContentCardToneClasses } from "./designSystem.js"
import { Layer } from "./Layout.js"

const densityClassName = (density: ContentCardDensity): string =>
  Match.value(density).pipe(
    Match.when("compact", () => "flex flex-col gap-2 rounded-md border p-4 shadow-chip"),
    Match.when("standard", () => "flex flex-col gap-3 rounded-lg border p-5 shadow-chip"),
    Match.exhaustive
  )

const neutralClassName = "border-stage-200/95 bg-stage-0/74"

export const ContentCard = ({
  children,
  className,
  density,
  tone
}: {
  readonly children: ReactNode
  readonly className?: string
  readonly density: ContentCardDensity
  readonly tone?: ContentCardToneClasses
}) => {
  const base = densityClassName(density)
  const surface = tone !== undefined ? `${tone.border} ${tone.bg}` : neutralClassName
  const combined = className === undefined ? `${base} ${surface}` : `${base} ${surface} ${className}`

  return <Layer className={combined}>{children}</Layer>
}
