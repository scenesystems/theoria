import { Match } from "effect"
import * as Arr from "effect/Array"

import type { SurfaceVariant } from "../../../contracts/presentation.js"

import type { EvidenceDensity } from "../surfaceModel.js"
import type { EvidenceRow } from "./evidence-row.js"

import { SemanticText } from "./SemanticText.js"

const evidenceListClass = ({
  density,
  variant
}: {
  readonly density: EvidenceDensity
  readonly variant: SurfaceVariant
}): string =>
  Match.value(density).pipe(
    Match.when("compact", () => "mt-1 grid"),
    Match.orElse(() =>
      Match.value(variant).pipe(
        Match.when("expanded", () => "mt-2 grid sm:grid-cols-[minmax(9rem,11rem)_1fr] sm:gap-x-4"),
        Match.orElse(() => "mt-2 grid")
      )
    )
  )

const evidenceRowValueClass = ({
  density,
  variant
}: {
  readonly density: EvidenceDensity
  readonly variant: SurfaceVariant
}): string =>
  Match.value(density).pipe(
    Match.when("compact", () => "mt-1 text-ink-800"),
    Match.orElse(() =>
      Match.value(variant).pipe(
        Match.when("expanded", () => "mt-1.5 text-ink-800 sm:mt-0.5"),
        Match.orElse(() => "mt-1.5 text-ink-800")
      )
    )
  )

const rowLabelClassName = (density: EvidenceDensity, index: number): string =>
  Match.value(density).pipe(
    Match.when("compact", () =>
      index === 0 ? "py-1.5 text-ink-700" : "mt-2 border-t border-stage-200/75 pt-3 text-ink-700"),
    Match.orElse(() =>
      index === 0 ? "py-3 text-ink-700" : "mt-3 border-t border-stage-200/80 pt-3 text-ink-700 sm:mt-0"
    )
  )

const rowValueClassName = (density: EvidenceDensity, variant: SurfaceVariant, index: number): string => {
  const valueClass = evidenceRowValueClass({ density, variant })

  return density === "compact"
    ? `${valueClass} pb-1.5`
    : index === 0
    ? `${valueClass} pb-3`
    : `${valueClass} pb-3 sm:border-t sm:border-stage-200/80 sm:pt-3`
}

export const EvidenceRows = ({
  density,
  rows,
  variant
}: {
  readonly density: EvidenceDensity
  readonly rows: ReadonlyArray<EvidenceRow>
  readonly variant: SurfaceVariant
}) => (
  <dl className={evidenceListClass({ density, variant })}>
    {Arr.flatMap(rows, (row, index) => [
      <SemanticText
        as="dt"
        className={rowLabelClassName(density, index)}
        key={`${row.label}:label`}
        role="row-label"
        text={row.label}
        variant={variant}
      />,
      <SemanticText
        as="dd"
        className={rowValueClassName(density, variant, index)}
        key={`${row.label}:value`}
        role="row-value"
        text={row.value}
        variant={variant}
      />
    ])}
  </dl>
)
