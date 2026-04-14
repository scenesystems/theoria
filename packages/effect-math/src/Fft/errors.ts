/**
 * Typed error taxonomy for FFT operations.
 *
 * @since 0.3.0
 * @category errors
 */
import { Schema } from "effect"

import type { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"

/**
 * Raised when operation-specific FFT input decoding fails.
 *
 * @since 0.3.0
 * @category errors
 */
export class FftDecodeError extends Schema.TaggedError<FftDecodeError>()("FftDecodeError", {
  operation: Schema.String,
  message: Schema.String
}) {}

/**
 * Raised when an FFT operation receives an invalid sequence length.
 *
 * @since 0.3.0
 * @category errors
 */
export class FftLengthError extends Schema.TaggedError<FftLengthError>()("FftLengthError", {
  operation: Schema.String,
  message: Schema.String
}) {}

/**
 * Raised when a real-spectrum payload does not satisfy the Hermitian half-spectrum shape.
 *
 * @since 0.3.0
 * @category errors
 */
export class FftSpectrumShapeError extends Schema.TaggedError<FftSpectrumShapeError>()("FftSpectrumShapeError", {
  operation: Schema.String,
  message: Schema.String
}) {}

/**
 * Raised under strict precision when an FFT result contains non-finite values.
 *
 * @since 0.3.0
 * @category errors
 */
export class FftDomainViolationError extends Schema.TaggedError<FftDomainViolationError>()("FftDomainViolationError", {
  operation: Schema.String,
  message: Schema.String
}) {}

/**
 * Boundary-level FFT schema errors.
 *
 * @since 0.3.0
 * @category errors
 */
export type FftBoundaryError = BoundaryDecodeError | BoundaryEncodeError

/**
 * Operation-level FFT errors.
 *
 * @since 0.3.0
 * @category errors
 */
export type FftOperationError =
  | FftDecodeError
  | FftLengthError
  | FftSpectrumShapeError
  | FftDomainViolationError
