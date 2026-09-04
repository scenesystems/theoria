import { Match } from "effect"
import * as Option from "effect/Option"

import { type LegendTheme } from "./designSystem.js"
import { Layer } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

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

const RailValue = ({ value }: { readonly value: Option.Option<string> }) =>
  Option.match(value, {
    onNone: () => null,
    onSome: (text) => (
      <Layer className="min-w-0">
        <SemanticText
          as="span"
          className="block max-w-none whitespace-nowrap text-ink-600"
          role="code-meta"
          text={text}
          variant="expanded"
        />
      </Layer>
    )
  })

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
}) => {
  const resolvedValue = Option.fromNullable(value)

  return variant === "rail"
    ? (
      <Layer className={className ?? "grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1"}>
        <Layer
          aria-hidden
          as="span"
          className={`${swatchClassName({ swatch: theme.swatch, shape })} ${
            Option.isSome(resolvedValue) ? "row-span-2" : "row-span-1"
          } mt-0.5`}
        />
        <Layer className="min-w-0">
          <SemanticText
            as="span"
            className={`${theme.label} block max-w-none whitespace-nowrap`}
            role="row-label"
            text={label}
            variant="expanded"
          />
        </Layer>
        <RailValue value={resolvedValue} />
      </Layer>
    )
    : (
      <Layer className={className ?? "inline-flex items-center gap-1.5"}>
        <Layer aria-hidden as="span" className={swatchClassName({ swatch: theme.swatch, shape })} />
        <SemanticText
          as="span"
          className={theme.label}
          role="code-meta"
          text={Option.match(resolvedValue, {
            onNone: () => label,
            onSome: (text) => `${label} ${text}`
          })}
          variant="expanded"
        />
      </Layer>
    )
}
