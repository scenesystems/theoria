import { Match } from "effect"

import { Layer } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"
import { type Legend } from "./theme/evidence.js"

type LegendShape = "circle" | "square" | "diamond"
type LegendVariant = "inline" | "rail"

const swatchClassName = ({
  swatch,
  shape
}: {
  readonly swatch: string
  readonly shape: LegendShape
}): string =>
  Match.value(shape).pipe(
    Match.when("circle", () => `inline-flex size-2.5 rounded-full ${swatch}`),
    Match.when("diamond", () => `inline-flex size-2.5 rotate-45 rounded-sm ${swatch}`),
    Match.orElse(() => `inline-flex size-2.5 rounded-sm ${swatch}`)
  )

export const LegendItem = ({
  className,
  legend,
  label,
  shape,
  value,
  variant = "inline"
}: {
  readonly className?: string
  readonly legend: Legend
  readonly label: string
  readonly shape: LegendShape
  readonly value?: string
  readonly variant?: LegendVariant
}) =>
  variant === "rail"
    ? (
      <Layer className={className ?? "grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1"}>
        <Layer
          aria-hidden
          as="span"
          className={`${swatchClassName({ swatch: legend.swatch, shape })} ${
            value === undefined ? "row-span-1" : "row-span-2"
          } mt-0.5`}
        />
        <Layer as="dt" className="min-w-0">
          <SemanticText
            as="span"
            className={`${legend.label} block max-w-none whitespace-nowrap`}
            role="row-label"
            text={label}
            variant="expanded"
          />
        </Layer>
        {value === undefined
          ? null
          : (
            <Layer as="dd" className="min-w-0">
              <SemanticText
                as="span"
                className="block max-w-none whitespace-nowrap text-ink-600"
                role="code-meta"
                text={value}
                variant="expanded"
              />
            </Layer>
          )}
      </Layer>
    )
    : (
      <Layer className={className ?? "inline-flex items-center gap-1.5"}>
        <Layer aria-hidden as="span" className={swatchClassName({ swatch: legend.swatch, shape })} />
        <SemanticText
          as="span"
          className={legend.label}
          role="code-meta"
          text={value === undefined ? label : `${label} ${value}`}
          variant="expanded"
        />
      </Layer>
    )
