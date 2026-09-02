/**
 * Defines typed failures for Geometry boundary and calculation operations.
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
    /** Diagnostic supplied by the boundary that rejected the descriptor. */
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
  /** Public geometry operation whose input failed decoding. */
  operation: Schema.String,
  /** Effect Schema issue report for the rejected input. */
  message: Schema.String
}) {}

/**
 * Reports incompatible operand dimensions, such as a distance
 * computation between points of different dimensionality, or a midpoint of
 * vectors with mismatched lengths. The `expected` and `actual` fields carry
 * human-readable dimension strings for diagnostic messages.
 *
 * @since 0.1.0
 * @category errors
 */
export class GeometryShapeMismatchError
  extends Schema.TaggedError<GeometryShapeMismatchError>()("GeometryShapeMismatchError", {
    /** Geometry operation that compared incompatible dimensions. */
    operation: Schema.String,
    /** Required operand shape or dimensionality. */
    expected: Schema.String,
    /** Shape or dimensionality found in the rejected operand. */
    actual: Schema.String,
    /** Diagnostic combining the operation and shape details. */
    message: Schema.String
  })
{}

/**
 * Describes a degenerate geometric configuration.
 *
 * @remarks
 * Current public operations reject empty centroid input during decoding and
 * do not emit this error.
 *
 * @since 0.1.0
 * @category errors
 */
export class GeometryDegenerateError extends Schema.TaggedError<GeometryDegenerateError>()("GeometryDegenerateError", {
  /** Geometry operation that encountered a degenerate configuration. */
  operation: Schema.String,
  /** Diagnostic identifying the failed geometric invariant. */
  message: Schema.String
}) {}

/**
 * Reports a non-finite result rejected by strict precision. Relaxed precision
 * passes the result through.
 *
 * @since 0.1.0
 * @category errors
 */
export class GeometryDomainViolationError
  extends Schema.TaggedError<GeometryDomainViolationError>()("GeometryDomainViolationError", {
    /** Strict-policy operation that produced a non-finite result. */
    operation: Schema.String,
    /** Diagnostic containing the rejected result or finite-result requirement. */
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
