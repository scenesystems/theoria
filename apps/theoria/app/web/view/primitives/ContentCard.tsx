import { Match } from "effect"
import type { ComponentPropsWithRef, ReactNode } from "react"

import type { ContentCardDensity, ContentCardShape } from "../../../contracts/presentation/layout.js"

import { Layer } from "./Layout.js"
import type { ContentCardTone } from "./theme/tone.js"

type ContentCardAppearance = "emphasis" | "inset"

const gapClassName = (density: ContentCardDensity): string =>
  Match.value(density).pipe(
    Match.when("compact", () => "flex flex-col gap-2.5 p-4"),
    Match.when("standard", () => "flex flex-col gap-3 p-5"),
    Match.exhaustive
  )

const shapeClassName = (density: ContentCardDensity, shape: ContentCardShape): string =>
  Match.value(shape).pipe(
    Match.when("rounded", () =>
      Match.value(density).pipe(
        Match.when("compact", () => "rounded-md border"),
        Match.when("standard", () => "rounded-lg border"),
        Match.exhaustive
      )),
    Match.when("left-accent", () => "border-l-[3px]"),
    Match.exhaustive
  )

const surfaceClassName = ({
  appearance,
  tone
}: {
  readonly appearance: ContentCardAppearance
  readonly tone: ContentCardTone | undefined
}): string => {
  if (tone !== undefined) {
    return `${tone.border} ${tone.bg}${appearance === "emphasis" ? " shadow-chip" : ""}`
  }

  return appearance === "emphasis"
    ? "border-stage-200/95 bg-stage-0/74 shadow-chip"
    : "border-stage-200/56 bg-stage-50/30"
}

export const ContentCard = ({
  appearance = "emphasis",
  children,
  className,
  density,
  shape = "rounded",
  tone,
  ...rest
}: {
  readonly appearance?: ContentCardAppearance
  readonly children: ReactNode
  readonly className?: string
  readonly density: ContentCardDensity
  readonly shape?: ContentCardShape
  readonly tone?: ContentCardTone
} & Omit<ComponentPropsWithRef<"div">, "children" | "className">) => {
  const base = `${gapClassName(density)} ${shapeClassName(density, shape)}`
  const surface = surfaceClassName({ appearance, tone })
  const combined = className === undefined ? `${base} ${surface}` : `${base} ${surface} ${className}`

  return <Layer {...rest} className={combined}>{children}</Layer>
}
