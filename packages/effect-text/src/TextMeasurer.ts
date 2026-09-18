/**
 * Advance-width measurement capabilities and deterministic estimates.
 *
 * @since 0.5.0
 * @module
 */
import { Array, Boolean, Context, Effect, Layer, Match, Number, Option, Schema } from "effect"

import type * as Text from "./Text.js"

/**
 * A measurement that could not produce a finite, non-negative advance.
 * The original measurement error tag is preserved for typed recovery.
 *
 * @since 0.5.0
 * @category errors
 */
export class Failed extends Schema.TaggedError<Failed>("@scenesystems/effect-text/TextMeasurer/Failed")(
  "MeasurementFailed",
  {
    fontFamily: Schema.String,
    fontSize: Schema.Number.pipe(Schema.finite()),
    text: Schema.String,
    reason: Schema.String
  }
) {}

/**
 * Measures text advances in units consistent with the requested font size.
 * Implementations report expected host or font failures through `Failed`.
 *
 * @since 0.5.0
 * @category services
 */
export class TextMeasurer extends Context.Tag("@scenesystems/effect-text/TextMeasurer")<
  TextMeasurer,
  { readonly measure: (font: Text.Font, text: string) => Effect.Effect<number, Failed> }
>() {}

const isWhitespace = Schema.is(Schema.String.pipe(Schema.pattern(/^\s$/u)))
const isWide = Schema.is(Schema.String.pipe(Schema.pattern(/[A-Z0-9]/u)))

const weightScale = (weight: number): number =>
  Boolean.match(Number.lessThanOrEqualTo(weight, 400), {
    onTrue: () => 1,
    onFalse: () => Number.sum(1, Number.multiply(Number.subtract(weight, 400), 0.0003))
  })

const characterWidth = (font: Text.Font, character: string): number => {
  const base = Match.value(character).pipe(
    Match.when(isWhitespace, () => Number.multiply(font.size, 0.33)),
    Match.when(isWide, () => Number.multiply(font.size, 0.64)),
    Match.orElse(() => Number.multiply(font.size, 0.58))
  )
  const weight = Option.fromNullable(font.weight).pipe(Option.getOrElse(() => 400))
  return Number.multiply(base, weightScale(weight))
}

/**
 * Deterministic width estimator for servers, tests, and non-browser rendering.
 * It is not a font-shaping engine; use `CanvasTextMeasurer.layer` for live canvas widths.
 *
 * @since 0.5.0
 * @category layers
 */
export const layer = Layer.succeed(TextMeasurer, {
  measure: (font, text) =>
    Effect.sync(() =>
      Array.reduce(
        Array.fromIterable(text),
        0,
        (width, character) => Number.sum(width, characterWidth(font, character))
      )
    )
})
