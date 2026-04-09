import { Slider } from "@base-ui-components/react/slider"

import { Cluster, Stack } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"
import type { Tone } from "./theme/tone.js"

// ---------------------------------------------------------------------------
// SliderRow — compact inline control: label | slider | value
// Takes Tone for consistent per-tone theming.
// ---------------------------------------------------------------------------

type SliderRowLayout = "inline" | "stacked"

const sliderControl = ({
  tone,
  thumbClassName,
  trackClassName
}: {
  readonly tone: Tone
  readonly thumbClassName: string
  readonly trackClassName: string
}) => (
  <Slider.Control className="relative flex h-5 w-full items-center">
    <Slider.Track className={trackClassName}>
      <Slider.Indicator className={`rounded-full ${tone.indicator}`} />
    </Slider.Track>
    <Slider.Thumb className={thumbClassName} />
  </Slider.Control>
)

export const SliderRow = ({
  label,
  value,
  display,
  min,
  max,
  step,
  disabled,
  hint,
  hintNoWrap = false,
  layout = "inline",
  onChange,
  tone
}: {
  readonly label: string
  readonly value: number
  readonly display: string
  readonly min: number
  readonly max: number
  readonly step: number
  readonly disabled: boolean
  readonly hint?: string
  readonly hintNoWrap?: boolean
  readonly layout?: SliderRowLayout
  readonly onChange: (v: number) => void
  readonly tone: Tone
}) =>
  layout === "stacked"
    ? (
      <Stack className="gap-3">
        <Cluster className="items-end justify-between gap-3">
          <Stack className="min-w-0 gap-1">
            <SemanticText as="dt" className="text-ink-700" role="row-label" text={label} variant="expanded" />
            {hint === undefined
              ? null
              : (
                hintNoWrap
                  ? (
                    <SemanticText
                      as="span"
                      className="block max-w-none text-ink-700/78"
                      role="code-meta"
                      text={hint}
                      variant="expanded"
                    />
                  )
                  : (
                    <SemanticText
                      as="p"
                      className="text-ink-700/78"
                      role="code-meta"
                      text={hint}
                      variant="expanded"
                    />
                  )
              )}
          </Stack>
          <SemanticText
            as="dd"
            className="tabular-nums text-ink-900"
            role="row-value"
            text={display}
            variant="expanded"
          />
        </Cluster>
        <Slider.Root
          className="relative flex min-w-0 touch-none items-center"
          disabled={disabled}
          max={max}
          min={min}
          onValueChange={onChange}
          step={step}
          value={value}
        >
          {sliderControl({
            tone,
            thumbClassName:
              `block size-4 rounded-full border-[3px] ${tone.border} bg-stage-0 shadow-chip focus-visible:ring-2 ${tone.focusRing} focus-visible:ring-offset-1`,
            trackClassName: "h-1.5 w-full rounded-full bg-stage-200"
          })}
        </Slider.Root>
      </Stack>
    )
    : (
      <Cluster className="w-full flex-nowrap items-center gap-2">
        <SemanticText
          as="dt"
          className="w-12 shrink-0 text-right text-ink-700"
          role="row-label"
          text={label}
          variant="expanded"
        />
        <Slider.Root
          className="relative flex min-w-0 flex-1 touch-none items-center"
          disabled={disabled}
          max={max}
          min={min}
          onValueChange={onChange}
          step={step}
          value={value}
        >
          {sliderControl({
            tone,
            thumbClassName:
              `block size-3 rounded-full border-2 ${tone.border} bg-stage-0 shadow-chip focus-visible:ring-2 ${tone.focusRing} focus-visible:ring-offset-1`,
            trackClassName: "h-0.5 w-full rounded-full bg-stage-200"
          })}
        </Slider.Root>
        <SemanticText
          as="dd"
          className="w-12 shrink-0 tabular-nums text-ink-900"
          role="row-value"
          text={display}
          variant="expanded"
        />
      </Cluster>
    )
