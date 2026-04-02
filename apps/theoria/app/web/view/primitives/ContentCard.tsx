import { Match } from "effect"
import type { ComponentPropsWithRef, ReactNode } from "react"

import type { ContentCardDensity, ContentCardShape } from "../../../contracts/layout.js"

import type { ContentCardToneClasses } from "./designSystem.js"
import { Layer } from "./Layout.js"

const gapClassName = (density: ContentCardDensity): string =>
  Match.value(density).pipe(
    Match.when("compact", () => "flex flex-col gap-2 p-4 shadow-chip"),
    Match.when("standard", () => "flex flex-col gap-3 p-5 shadow-chip"),
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

const neutralClassName = "border-stage-200/95 bg-stage-0/74"

export const ContentCard = ({
  children,
  className,
  density,
  shape = "rounded",
  tone,
  ...rest
}: {
  readonly children: ReactNode
  readonly className?: string
  readonly density: ContentCardDensity
  readonly shape?: ContentCardShape
  readonly tone?: ContentCardToneClasses
} & Omit<ComponentPropsWithRef<"div">, "children" | "className">) => {
  const base = `${gapClassName(density)} ${shapeClassName(density, shape)}`
  const surface = tone !== undefined ? `${tone.border} ${tone.bg}` : neutralClassName
  const combined = className === undefined ? `${base} ${surface}` : `${base} ${surface} ${className}`

  return <Layer {...rest} className={combined}>{children}</Layer>
}
