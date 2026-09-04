import { Match } from "effect"
import * as Option from "effect/Option"
import type { HTMLAttributes, ReactNode } from "react"

import type { ContentCardDensity, ContentCardShape } from "../../../contracts/layout.js"

import { classNames } from "./classNames.js"
import type { ContentCardToneClasses } from "./designSystem.js"
import { Layer } from "./Layout.js"

const gapClassName = (density: ContentCardDensity): string =>
  Match.value(density).pipe(
    Match.when("compact", () => "flex flex-col gap-2 p-4 shadow-chip"),
    Match.when("standard", () => "flex flex-col gap-3 p-4 shadow-chip sm:p-5"),
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
  className = "",
  density,
  shape = "rounded",
  tone,
  ...rest
}: HTMLAttributes<HTMLElement> & {
  readonly children: ReactNode
  readonly className?: string
  readonly density: ContentCardDensity
  readonly shape?: ContentCardShape
  readonly tone?: ContentCardToneClasses
}) => {
  const surface = Option.match(Option.fromNullable(tone), {
    onNone: () => neutralClassName,
    onSome: (resolved) => `${resolved.border} ${resolved.bg}`
  })

  return (
    <Layer {...rest} className={classNames(gapClassName(density), shapeClassName(density, shape), surface, className)}>
      {children}
    </Layer>
  )
}
