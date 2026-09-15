/**
 * Canvas font serialization, state-safe measurement, and optional emoji width correction.
 *
 * @since 0.1.0
 */
import { Boolean, Data, Effect, Equal, Exit, Inspectable, Match, Number, Option, Schema, String } from "effect"
import type * as Types from "effect/Types"

import { MeasurementFailed } from "../../Errors/index.js"
import { containsEmoji, stripEmojiClusters } from "../../Text/internal/analysis.js"
import type { FontDescriptorType } from "../../Text/schema.js"

/**
 * Canvas direction values supported by the browser 2D context contract.
 *
 * @since 0.4.0
 * @category schemas
 */
export const CanvasTextDirection = Schema.Literal("ltr", "rtl", "inherit")
/**
 * Canvas direction assigned around a measurement.
 *
 * @since 0.4.0
 * @category models
 */
export type CanvasTextDirectionType = typeof CanvasTextDirection.Type

/**
 * Canvas baseline values supported by the browser 2D context contract.
 *
 * @since 0.4.0
 * @category schemas
 */
export const CanvasTextBaseline = Schema.Literal(
  "top",
  "hanging",
  "middle",
  "alphabetic",
  "ideographic",
  "bottom"
)
/**
 * Canvas baseline assigned around a measurement.
 *
 * @since 0.4.0
 * @category models
 */
export type CanvasTextBaselineType = typeof CanvasTextBaseline.Type

/**
 * The approved portion of `TextMetrics` read by browser measurement.
 *
 * @since 0.4.0
 * @category schemas
 */
export const CanvasTextMetrics = Schema.Struct({ width: Schema.Number })
/**
 * The approved portion of a canvas measurement result.
 *
 * @since 0.4.0
 * @category models
 */
export type CanvasTextMetricsType = typeof CanvasTextMetrics.Type

class CanvasMeasurementContextReadonly extends Data.Class<{
  readonly direction: CanvasTextDirectionType
  readonly font: string
  readonly measureText: (text: string) => CanvasTextMetricsType
  readonly textBaseline: CanvasTextBaselineType
}> {}

/**
 * Exact mutable subset of a browser canvas 2D context used by this package.
 *
 * @remarks
 * The contract matches the browser names and signatures for `font`,
 * `direction`, `textBaseline`, and `measureText`. No other host capability is
 * read or invoked.
 *
 * @since 0.2.0
 * @category models
 */
export type CanvasMeasurementContext = Types.Mutable<CanvasMeasurementContextReadonly>

const PositiveFiniteNumber = Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0))

/**
 * Decoder for custom additive emoji-width correction settings.
 *
 * @since 0.4.0
 * @category schemas
 */
export const EmojiCorrectionConfiguration = Schema.Struct({
  minimumAdvanceMultiplier: Schema.optional(PositiveFiniteNumber),
  probe: Schema.optional(Schema.String)
})

/**
 * Boolean or custom emoji-width correction selection.
 *
 * @since 0.4.0
 * @category schemas
 */
export const EmojiCorrection = Schema.Union(Schema.Boolean, EmojiCorrectionConfiguration)
/**
 * Decoded emoji-width correction selection.
 *
 * @since 0.4.0
 * @category models
 */
export type EmojiCorrectionType = typeof EmojiCorrection.Type

/** Resolved correction settings used by the canvas layer. */
class NormalizedEmojiCorrection extends Schema.Class<NormalizedEmojiCorrection>(
  "effect-text/NormalizedEmojiCorrection"
)({
  minimumAdvanceMultiplier: PositiveFiniteNumber,
  probe: Schema.String
}) {}

class ContextSnapshot extends Schema.Class<ContextSnapshot>("effect-text/CanvasContextSnapshot")({
  direction: CanvasTextDirection,
  font: Schema.String,
  textBaseline: CanvasTextBaseline
}) {}

const measurementFailure = (font: FontDescriptorType, text: string, reason: string) =>
  new MeasurementFailed({
    fontFamily: font.family,
    fontSize: font.size,
    text,
    reason
  })

const hostFailure = (font: FontDescriptorType, text: string, operation: string, cause: unknown) =>
  measurementFailure(
    font,
    text,
    String.concat(operation, String.concat(" failed: ", Inspectable.toStringUnknown(cause, 0)))
  )

const snapshotContext = (
  context: CanvasMeasurementContext,
  font: FontDescriptorType,
  text: string
): Effect.Effect<ContextSnapshot, MeasurementFailed> =>
  Effect.try({
    try: () =>
      new ContextSnapshot({
        direction: context.direction,
        font: context.font,
        textBaseline: context.textBaseline
      }),
    catch: (cause) => hostFailure(font, text, "canvas state read", cause)
  })

const assignContext = (
  context: CanvasMeasurementContext,
  snapshot: ContextSnapshot,
  font: FontDescriptorType,
  text: string,
  direction: Option.Option<CanvasTextDirectionType>,
  textBaseline: Option.Option<CanvasTextBaselineType>
): Effect.Effect<void, MeasurementFailed> =>
  Effect.try({
    try: () => {
      context.font = toCanvasFont(font)
      context.direction = Option.getOrElse(direction, () => snapshot.direction)
      context.textBaseline = Option.getOrElse(textBaseline, () => snapshot.textBaseline)
    },
    catch: (cause) => hostFailure(font, text, "canvas state assignment", cause)
  })

const restoreContext = (
  context: CanvasMeasurementContext,
  snapshot: ContextSnapshot,
  font: FontDescriptorType,
  text: string
): Effect.Effect<void, MeasurementFailed> =>
  Effect.try({
    try: () => {
      context.font = snapshot.font
      context.direction = snapshot.direction
      context.textBaseline = snapshot.textBaseline
    },
    catch: (cause) => hostFailure(font, text, "canvas state restoration", cause)
  })

/**
 * Renders a `FontDescriptor` into the canvas `font` string expected by `measureText`.
 *
 * @since 0.2.0
 * @category internals
 */
export const toCanvasFont = (font: FontDescriptorType): string => {
  const weight = Option.fromNullable(font.weight).pipe(Option.getOrElse(() => 400))
  const sizeAndFamily = String.concat(
    Inspectable.toStringUnknown(font.size, 0),
    String.concat("px ", font.family)
  )

  return Boolean.match(Equal.equals(weight, 400), {
    onFalse: () => String.concat(Inspectable.toStringUnknown(weight, 0), String.concat(" ", sizeAndFamily)),
    onTrue: () => sizeAndFamily
  })
}

/**
 * Normalizes a decoded emoji-correction selection into one internal model.
 *
 * @since 0.2.0
 * @category internals
 */
export const normalizeEmojiCorrection = (
  emojiCorrection: Option.Option<EmojiCorrectionType>
): Option.Option<NormalizedEmojiCorrection> =>
  emojiCorrection.pipe(
    Option.flatMap((selection) =>
      Match.value(selection).pipe(
        Match.when(false, () => Option.none()),
        Match.when(
          true,
          () => Option.some(new NormalizedEmojiCorrection({ probe: "🙂", minimumAdvanceMultiplier: 1 }))
        ),
        Match.when(Schema.is(EmojiCorrectionConfiguration), (configuration) =>
          Option.some(
            new NormalizedEmojiCorrection({
              probe: Option.fromNullable(configuration.probe).pipe(Option.getOrElse(() => "🙂")),
              minimumAdvanceMultiplier: Option.fromNullable(configuration.minimumAdvanceMultiplier).pipe(
                Option.getOrElse(() => 1)
              )
            })
          )),
        Match.exhaustive
      )
    )
  )

const measureAssignedText = (
  context: CanvasMeasurementContext,
  font: FontDescriptorType,
  text: string
): Effect.Effect<number, MeasurementFailed> =>
  Boolean.match(String.isEmpty(text), {
    onFalse: () =>
      Effect.try({
        try: () => context.measureText(text).width,
        catch: (cause) => hostFailure(font, text, "measureText", cause)
      }).pipe(
        Effect.filterOrFail(
          Schema.is(Schema.NonNegative.pipe(Schema.finite())),
          (width) =>
            measurementFailure(
              font,
              text,
              String.concat("measureText returned ", Inspectable.toStringUnknown(width, 0))
            )
        )
      ),
    onTrue: () => Effect.succeed(0)
  })

/**
 * Measures text on a canvas context while restoring prior context state afterward.
 *
 * @since 0.2.0
 * @category internals
 */
export const measureCanvasText = (
  context: CanvasMeasurementContext,
  font: FontDescriptorType,
  text: string,
  direction: Option.Option<CanvasTextDirectionType>,
  textBaseline: Option.Option<CanvasTextBaselineType>
): Effect.Effect<number, MeasurementFailed> =>
  snapshotContext(context, font, text).pipe(
    Effect.flatMap((snapshot) =>
      Effect.uninterruptibleMask((restore) =>
        restore(
          assignContext(context, snapshot, font, text, direction, textBaseline).pipe(
            Effect.zipRight(measureAssignedText(context, font, text))
          )
        ).pipe(
          Effect.exit,
          Effect.flatMap((useExit) =>
            restoreContext(context, snapshot, font, text).pipe(
              Effect.exit,
              Effect.flatMap((restorationExit) => Exit.zipLeft(useExit, restorationExit))
            )
          )
        )
      )
    )
  )

/**
 * Applies the additive emoji-width floor when raw canvas measurement underestimates emoji clusters.
 *
 * @since 0.2.0
 * @category internals
 */
export const correctEmojiWidth = (
  text: string,
  rawWidth: number,
  emojiAdvance: number,
  measureWithoutEmoji: (strippedText: string) => Effect.Effect<number, MeasurementFailed>
): Effect.Effect<number, MeasurementFailed> =>
  Boolean.match(containsEmoji(text), {
    onFalse: () => Effect.succeed(rawWidth),
    onTrue: () => {
      const stripped = stripEmojiClusters(text)
      const correctionIsRedundant = Boolean.or(Equal.equals(stripped.count, 0), Equal.equals(stripped.text, text))

      return Boolean.match(correctionIsRedundant, {
        onFalse: () =>
          measureWithoutEmoji(stripped.text).pipe(
            Effect.map((strippedWidth) =>
              Number.max(rawWidth, Number.sum(strippedWidth, Number.multiply(stripped.count, emojiAdvance)))
            )
          ),
        onTrue: () => Effect.succeed(rawWidth)
      })
    }
  })
