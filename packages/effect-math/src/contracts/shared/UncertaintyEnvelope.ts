/**
 * Uncertainty envelope contracts for advanced computation outputs.
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
 * Finite Float64 bounds ordered so `lower <= upper`.
 *
 * @since 0.1.0
 * @category contracts
 */
export const Float64Interval = Schema.Struct({
  lower: Schema.Number.pipe(Schema.finite()),
  upper: Schema.Number.pipe(Schema.finite())
}).pipe(Schema.filter((interval) => N.lessThanOrEqualTo(interval.lower, interval.upper) || "Expected lower <= upper"))

/**
 * BigDecimal bounds ordered so `lower <= upper`.
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
 * A finite Float64 estimate with non-negative absolute/relative errors and an
 * optional ordered interval in the same scalar units.
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
 * A BigDecimal estimate with non-negative absolute/relative errors and an
 * optional ordered BigDecimal interval.
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
 * Selects the envelope branch by `scalarKind`, preventing Float64 and
 * BigDecimal values, errors, or intervals from being mixed.
 *
 * @since 0.1.0
 * @category contracts
 */
export const UncertaintyEnvelope = Schema.Union(Float64UncertaintyEnvelope, BigDecimalUncertaintyEnvelope)

/**
 * A scalar-discriminated estimate whose value, errors, and interval stay in one lane.
 *
 * @since 0.1.0
 * @category models
 */
export type UncertaintyEnvelopeType = typeof UncertaintyEnvelope.Type

/**
 * Contract indicating whether an operation requires uncertainty propagation.
 *
 * @since 0.1.0
 * @category contracts
 */
export const UncertaintyRequirement = Schema.Struct({
  scalarKind: ScalarKind,
  required: Schema.Boolean
})

/**
 * The scalar lane for an operation and whether its result must propagate an envelope.
 *
 * @since 0.1.0
 * @category models
 */
export type UncertaintyRequirementType = typeof UncertaintyRequirement.Type
