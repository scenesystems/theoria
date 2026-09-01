/**
 * Typed error taxonomy for the Geometry domain. Each error is a
 * `Schema.TaggedError` so it round-trips through Effect channels and
 * can be pattern-matched by `_tag`. Errors are stratified into boundary
 * failures (decode/encode) and operation failures (shape, degenerate,
 * domain violation).
 *
 * @since 0.1.0
 * @category errors
 */
import { Schema } from "effect"

import type { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"

/**
 * Reports failure to validate the Geometry descriptor before metric or
 * point-set orchestration begins.
 *
 * @since 0.1.0
 * @category errors
 */
export class GeometryDomainBoundaryError
  extends Schema.TaggedError<GeometryDomainBoundaryError>()("GeometryDomainBoundaryError", {
    message: Schema.String
  })
{}

/**
 * Reports rejected boundary input for a geometry distance, midpoint, or
 * centroid operation.
 *
 * @remarks
 * `operation` identifies the attempted calculation and `message` preserves the
 * rendered Schema issue for diagnostics.
 *
 * @since 0.1.0
 * @category errors
 */
export class GeometryDecodeError extends Schema.TaggedError<GeometryDecodeError>()("GeometryDecodeError", {
  operation: Schema.String,
  message: Schema.String
}) {}

/**
 * Raised when operand dimensions are incompatible — for example, a distance
 * computation between points of different dimensionality, or a midpoint of
 * vectors with mismatched lengths. The `expected` and `actual` fields carry
 * human-readable dimension strings for diagnostic messages.
 *
 * @since 0.1.0
 * @category errors
 */
export class GeometryShapeMismatchError
  extends Schema.TaggedError<GeometryShapeMismatchError>()("GeometryShapeMismatchError", {
    operation: Schema.String,
    expected: Schema.String,
    actual: Schema.String,
    message: Schema.String
  })
{}

/**
 * Raised when an input describes a degenerate geometric configuration —
 * for example, a centroid of an empty point set, or collinear points
 * where a triangle is expected. Use this to distinguish geometric
 * invalidity from numeric overflow.
 *
 * @since 0.1.0
 * @category errors
 */
export class GeometryDegenerateError extends Schema.TaggedError<GeometryDegenerateError>()("GeometryDegenerateError", {
  operation: Schema.String,
  message: Schema.String
}) {}

/**
 * Raised under the `"strict"` precision policy when an operation produces a
 * non-finite result (NaN or ±Infinity). Under `"relaxed"` precision this
 * error is never emitted. Use it to enforce IEEE 754 finite-value guarantees
 * in safety-critical pipelines.
 *
 * @since 0.1.0
 * @category errors
 */
export class GeometryDomainViolationError
  extends Schema.TaggedError<GeometryDomainViolationError>()("GeometryDomainViolationError", {
    operation: Schema.String,
    message: Schema.String
  })
{}

/**
 * Descriptor-level failures to recover before Geometry capability discovery;
 * operation inputs and geometric invariants are outside this boundary.
 *
 * @since 0.1.0
 * @category errors
 */
export type GeometryBoundaryError = GeometryDomainBoundaryError | BoundaryDecodeError | BoundaryEncodeError

/**
 * Calculation failures distinguishing malformed input, incompatible or
 * degenerate geometry, and strict-policy rejection of a non-finite result.
 *
 * @since 0.1.0
 * @category errors
 */
export type GeometryOperationError =
  | GeometryDecodeError
  | GeometryShapeMismatchError
  | GeometryDegenerateError
  | GeometryDomainViolationError
