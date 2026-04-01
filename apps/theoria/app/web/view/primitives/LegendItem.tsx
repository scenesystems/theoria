import { Match } from "effect"

import { type LegendTheme, surfaceMaterials } from "./designSystem.js"
import { Cluster, Layer, Stack } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

type LegendShape = "circle" | "square" | "diamond"
type LegendVariant = "inline" | "chip"

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
  label,
  shape,
  theme,
  value,
  variant = "inline"
}: {
  readonly className?: string
  readonly label: string
  readonly shape: LegendShape
  readonly theme: LegendTheme
  readonly value?: string
  readonly variant?: LegendVariant
}) =>
  variant === "chip"
    ? (
      <Cluster className={className ?? `${surfaceMaterials.supportPanelDense} items-start gap-2`}>
        <Layer aria-hidden as="span" className={swatchClassName({ swatch: theme.swatch, shape })} />
        <Stack className="min-w-0 gap-1">
          {value === undefined
            ? null
            : (
              <SemanticText
                as="p"
                className="text-ink-700/78"
                role="row-label"
                text={value}
                variant="expanded"
              />
            )}
          <SemanticText
            as="p"
            className={theme.label}
            role="status"
            text={label}
            variant="expanded"
          />
        </Stack>
      </Cluster>
    )
    : (
      <Cluster className={className ?? "gap-1.5"}>
        <Layer aria-hidden as="span" className={swatchClassName({ swatch: theme.swatch, shape })} />
        <SemanticText
          as="span"
          className={theme.label}
          role="code-meta"
          text={value === undefined ? label : `${label} ${value}`}
          variant="expanded"
        />
      </Cluster>
    )
