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
 * Raised when an orchestration-level boundary validation fails before
 * reaching the specific operation. Use this as a catch-all for validation
 * pipelines that span multiple operations within the domain.
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
 * Raised when Schema decode fails for a specific operation's input contract
 * (e.g. `DistanceInput`, `MidpointInput`). The `operation` field names the
 * failed operation so callers can branch on it in error-recovery logic.
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
 * Union of all boundary-level errors that can arise from domain validation,
 * Schema decode, or Schema encode at the package edge. Use as the error
 * channel type for boundary-crossing pipelines.
 *
 * @since 0.1.0
 * @category errors
 */
export type GeometryBoundaryError = GeometryDomainBoundaryError | BoundaryDecodeError | BoundaryEncodeError

/**
 * Union of all errors that can arise from within a geometry operation
 * (after boundary decode succeeds). Useful as a unified error channel type
 * for combinators that orchestrate multiple operations.
 *
 * @since 0.1.0
 * @category errors
 */
export type GeometryOperationError =
  | GeometryDecodeError
  | GeometryShapeMismatchError
  | GeometryDegenerateError
  | GeometryDomainViolationError
