/**
 * Distinguishes strict preparation-input decode failures from width
 * measurement failures.
 *
 * @remarks
 * Both variants occur before a prepared handle exists. Pure layout over a
 * successfully prepared handle has no typed failure channel.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Marks preparation failure tags and diagnostic fields as stable.
 *
 * @since 0.1.0
 * @category stability
 */
export const ErrorsStability = "stable"

/**
 * Reports why `Text.prepareUnknown` rejected its input before measurement.
 *
 * @remarks
 * `reason` is the formatted Effect Schema issue tree, including excess
 * properties because decoding is strict.
 *
 * @since 0.1.0
 * @category errors
 */
export class TextLayoutDecodeError extends Schema.TaggedError<TextLayoutDecodeError>()("TextLayoutDecodeError", {
  /** Formatted Effect Schema issue tree. */
  reason: Schema.String
}) {}

/**
 * Reports a failed width measurement during preparation.
 *
 * @remarks
 * The error retains the requested family, size, text, and implementation
 * reason. Pure layout cannot produce this error after preparation succeeds.
 *
 * @since 0.1.0
 * @category errors
 */
export class MeasurementFailed extends Schema.TaggedError<MeasurementFailed>()("MeasurementFailed", {
  /** Font family supplied to the failed measurement. */
  fontFamily: Schema.String,
  /** Font size supplied to the failed measurement. */
  fontSize: Schema.Number.pipe(Schema.finite()),
  /** Exact text supplied to the failed measurement. */
  text: Schema.String,
  /** Implementation diagnostic retained for recovery or logging. */
  reason: Schema.String
}) {}

/**
 * Failure channel of `Text.prepareUnknown`: strict schema decoding or width
 * measurement. Typed preparation input skips `TextLayoutDecodeError`.
 *
 * @since 0.1.0
 * @category errors
 */
export type PrepareError = MeasurementFailed | TextLayoutDecodeError
