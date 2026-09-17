/**
 * Canvas-backed text measurement with serialized, state-safe host access.
 *
 * @since 0.5.0
 * @module
 */
import { Data, Layer, Schema } from "effect"
import type * as Types from "effect/Types"

import { make } from "./internal/canvas.js"
import * as TextMeasurer from "./TextMeasurer.js"

/**
 * Canvas direction values used around a measurement.
 *
 * @since 0.5.0
 * @category schemas
 */
export const Direction = Schema.Literal("ltr", "rtl", "inherit")

/**
 * A canvas direction value.
 *
 * @since 0.5.0
 * @category models
 */
export type Direction = typeof Direction.Type

/**
 * Canvas baseline values used around a measurement.
 *
 * @since 0.5.0
 * @category schemas
 */
export const Baseline = Schema.Literal(
  "top",
  "hanging",
  "middle",
  "alphabetic",
  "ideographic",
  "bottom"
)

/**
 * A canvas baseline value.
 *
 * @since 0.5.0
 * @category models
 */
export type Baseline = typeof Baseline.Type

/**
 * The approved portion of a canvas text metrics result.
 *
 * @since 0.5.0
 * @category schemas
 */
export const Metrics = Schema.Struct({ width: Schema.Number })

/**
 * Canvas text metrics read by this package.
 *
 * @since 0.5.0
 * @category models
 */
export type Metrics = typeof Metrics.Type

class ReadonlyContext extends Data.Class<{
  readonly direction: Direction
  readonly font: string
  readonly measureText: (text: string) => Metrics
  readonly textBaseline: Baseline
}> {}

/**
 * Exact mutable canvas capability required by the measurement layer.
 *
 * @remarks
 * Only `font`, `direction`, and `textBaseline` are read, assigned, and
 * restored. Measurement reads only `measureText(text).width`.
 *
 * @since 0.5.0
 * @category models
 */
export type Context = Types.Mutable<ReadonlyContext>

const PositiveFinite = Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0))

/**
 * Custom additive emoji-width correction settings.
 *
 * @since 0.5.0
 * @category schemas
 */
export const CorrectionOptions = Schema.Struct({
  minimumAdvanceMultiplier: Schema.optional(PositiveFinite),
  probe: Schema.optional(Schema.String)
})

/**
 * Decoded custom emoji-width correction settings.
 *
 * @since 0.5.0
 * @category models
 */
export type CorrectionOptions = typeof CorrectionOptions.Type

/**
 * Disabled, default, or customized emoji-width correction.
 *
 * @since 0.5.0
 * @category schemas
 */
export const EmojiCorrection = Schema.Union(Schema.Boolean, CorrectionOptions)

/**
 * Decoded emoji-width correction selection.
 *
 * @since 0.5.0
 * @category models
 */
export type EmojiCorrection = typeof EmojiCorrection.Type

/**
 * Host capabilities and state selections retained by a canvas measurement layer.
 *
 * @since 0.5.0
 * @category models
 */
export class Options extends Data.Class<{
  readonly context: Context
  readonly direction?: Direction
  readonly emojiCorrection?: EmojiCorrection
  readonly textBaseline?: Baseline
}> {}

/**
 * Provides the principal `TextMeasurer` service using a canvas-like context.
 *
 * @remarks
 * Access is serialized. The approved context state is restored after success,
 * typed failure, or interruption. Optional emoji correction uses a per-font
 * probe cache and applies once per extended-pictographic, paired
 * regional-indicator flag, or keycap grapheme. Bare keycap bases and lone
 * regional indicators are not corrected. Widths already satisfying the floor
 * are unchanged.
 *
 * @since 0.5.0
 * @category layers
 */
export const layer = (options: Options) => Layer.scoped(TextMeasurer.TextMeasurer, make(options))
