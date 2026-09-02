/**
 * Defines scalar-specific intervals, error envelopes, and uncertainty requirements.
 *
 * @since 0.1.0
 * @category contracts
 */
import { BigDecimal, Number as N, Schema } from "effect"

import { ScalarKind } from "./ScalarAuthority.js"

const NonNegativeFiniteNumber = Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0))
const NonNegativeBigDecimal = Schema.BigDecimalFromSelf.pipe(
  Schema.filter(
    (value) => BigDecimal.greaterThanOrEqualTo(value, BigDecimal.fromNumber(0)) || "Expected non-negative BigDecimal"
  )
)

/**
 * Accepts finite Float64 interval bounds with `lower <= upper`.
 *
 * @since 0.1.0
 * @category contracts
 */
export const Float64Interval = Schema.Struct({
  lower: Schema.Number.pipe(Schema.finite()),
  upper: Schema.Number.pipe(Schema.finite())
}).pipe(Schema.filter((interval) => N.lessThanOrEqualTo(interval.lower, interval.upper) || "Expected lower <= upper"))

/**
 * Accepts BigDecimal interval bounds with `lower <= upper`.
 *
 * @since 0.1.0
 * @category contracts
 */
export const BigDecimalInterval = Schema.Struct({
  lower: Schema.BigDecimalFromSelf,
  upper: Schema.BigDecimalFromSelf
}).pipe(
  Schema.filter(
    (interval) => BigDecimal.lessThanOrEqualTo(interval.lower, interval.upper) || "Expected lower <= upper"
  )
)

/**
 * Accepts a finite Float64 estimate with non-negative finite error bounds.
 *
 * @remarks
 * The optional interval must be ordered. The Schema does not require it to
 * contain `value` or agree with either error field.
 *
 * @since 0.1.0
 * @category contracts
 */
export const Float64UncertaintyEnvelope = Schema.Struct({
  scalarKind: Schema.Literal("float64"),
  value: Schema.Number.pipe(Schema.finite()),
  absoluteError: NonNegativeFiniteNumber,
  relativeError: NonNegativeFiniteNumber,
  interval: Schema.optional(Float64Interval)
})

/**
 * Accepts a BigDecimal estimate with non-negative BigDecimal error bounds.
 *
 * @remarks
 * The optional interval must be ordered. The Schema does not require it to
 * contain `value` or agree with either error field.
 *
 * @since 0.1.0
 * @category contracts
 */
export const BigDecimalUncertaintyEnvelope = Schema.Struct({
  scalarKind: Schema.Literal("bigdecimal"),
  value: Schema.BigDecimalFromSelf,
  absoluteError: NonNegativeBigDecimal,
  relativeError: NonNegativeBigDecimal,
  interval: Schema.optional(BigDecimalInterval)
})

/**
 * Accepts a Float64 or BigDecimal envelope selected by `scalarKind`.
 *
 * @since 0.1.0
 * @category contracts
 */
export const UncertaintyEnvelope = Schema.Union(Float64UncertaintyEnvelope, BigDecimalUncertaintyEnvelope)

/**
 * A decoded estimate whose value, errors, and interval use one scalar representation.
 *
 * @since 0.1.0
 * @category models
 */
export type UncertaintyEnvelopeType = typeof UncertaintyEnvelope.Type

/**
 * Records whether a computation plan requires uncertainty propagation for a scalar lane.
 *
 * @remarks
 * This Schema records a requirement; it does not enforce that a result carries
 * an {@link UncertaintyEnvelope}.
 *
 * @since 0.1.0
 * @category contracts
 */
export const UncertaintyRequirement = Schema.Struct({
  scalarKind: ScalarKind,
  required: Schema.Boolean
})

/**
 * A decoded uncertainty requirement used during computation planning.
 *
 * @since 0.1.0
 * @category models
 */
export type UncertaintyRequirementType = typeof UncertaintyRequirement.Type
