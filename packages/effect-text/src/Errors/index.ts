/**
 * Stable typed errors for effect-text.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Stability lane for the Errors namespace.
 *
 * @since 0.1.0
 * @category stability
 */
export const ErrorsStability = "stable"

/**
 * Boundary decode failure for unknown prepare input.
 *
 * @since 0.1.0
 * @category errors
 */
export class TextLayoutDecodeError extends Schema.TaggedError<TextLayoutDecodeError>()("TextLayoutDecodeError", {
  reason: Schema.String
}) {}

/**
 * Text measurement failure.
 *
 * @since 0.1.0
 * @category errors
 */
export class MeasurementFailed extends Schema.TaggedError<MeasurementFailed>()("MeasurementFailed", {
  fontFamily: Schema.String,
  fontSize: Schema.Number.pipe(Schema.finite()),
  text: Schema.String,
  reason: Schema.String
}) {}

/**
 * Union of all prepare-time failures.
 *
 * @since 0.1.0
 * @category errors
 */
export type PrepareError = MeasurementFailed | TextLayoutDecodeError
