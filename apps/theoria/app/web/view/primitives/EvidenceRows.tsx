import { Separator } from "@base-ui-components/react/separator"
import { Match } from "effect"
import * as Arr from "effect/Array"

import type { SurfaceVariant } from "../../../contracts/presentation/program.js"

import type { EvidenceDensity } from "../surfaceModel.js"
import type { EvidenceRow } from "./evidence-row.js"

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
    Match.when("compact", () => "grid gap-1.5 py-1.5"),
    Match.orElse(() =>
      Match.value(variant).pipe(
        Match.when("expanded", () => "grid gap-2 py-3 sm:grid-cols-[minmax(9rem,11rem)_1fr] sm:gap-4"),
        Match.orElse(() => "py-2")
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
    Match.when("compact", () => "text-ink-700"),
    Match.orElse(() => "text-ink-700")
  )

const separatorClassName = (density: EvidenceDensity): string =>
  Match.value(density).pipe(
    Match.when("compact", () => "mb-2 h-px bg-stage-200/75"),
    Match.orElse(() => "mb-3 h-px bg-stage-200/80")
  )

export const EvidenceRows = ({
  density,
  rows,
  variant
}: {
  readonly density: EvidenceDensity
  readonly rows: ReadonlyArray<EvidenceRow>
  readonly variant: SurfaceVariant
}) => (
  <dl
    className={Match.value(density).pipe(
      Match.when("compact", () => "mt-1"),
      Match.orElse(() => "mt-2")
    )}
  >
    {Arr.map(rows, (row, index) => (
      <Layer key={`${row.label}:${row.value}`}>
        {index === 0 ? null : <Separator className={separatorClassName(density)} />}
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
  </dl>
)
