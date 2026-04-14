import { Match } from "effect"
import * as Arr from "effect/Array"

import type { PresentationDetailRow } from "../../../contracts/presentation/detail-row.js"
import type { SurfaceVariant } from "../../../contracts/presentation/program.js"
import type { EvidenceDensity } from "../../../contracts/presentation/surface-presentation.js"

import { Layer } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

const evidenceRowLayoutClass = ({
  density,
  variant
}: {
  readonly density: EvidenceDensity
  readonly variant: SurfaceVariant
}): string =>
  Match.value(density).pipe(
    Match.when("compact", () => "grid gap-1.5 py-2"),
    Match.orElse(() =>
      Match.value(variant).pipe(
        Match.when("expanded", () => "grid gap-2 py-3 sm:grid-cols-[minmax(9rem,11rem)_1fr] sm:gap-4"),
        Match.orElse(() => "grid gap-2 py-2.5")
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

const rowLabelClassName = (density: EvidenceDensity): string =>
  Match.value(density).pipe(
    Match.when("compact", () => "text-ink-600"),
    Match.orElse(() => "text-ink-700")
  )

const evidenceRowsShellClassName = (density: EvidenceDensity): string =>
  Match.value(density).pipe(
    Match.when("compact", () => "mt-1 divide-y divide-stage-200/56"),
    Match.orElse(() => "mt-2 divide-y divide-stage-200/60")
  )

export const EvidenceRows = ({
  density,
  rows,
  variant
}: {
  readonly density: EvidenceDensity
  readonly rows: ReadonlyArray<PresentationDetailRow>
  readonly variant: SurfaceVariant
}) => (
  <Layer as="dl" className={evidenceRowsShellClassName(density)}>
    {Arr.map(rows, (row) => (
      <Layer key={`${row.label}:${row.value}`}>
        <Layer className={evidenceRowLayoutClass({ density, variant })}>
          <SemanticText
            as="dt"
            className={rowLabelClassName(density)}
            role="row-label"
            text={row.label}
            variant={variant}
          />
          <SemanticText
            as="dd"
            className={evidenceRowValueClass({ density, variant })}
            role="row-value"
            text={row.value}
            variant={variant}
          />
        </Layer>
      </Layer>
    ))}
  </Layer>
)
