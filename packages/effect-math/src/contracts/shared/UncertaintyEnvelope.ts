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
 * Float64 interval contract.
 *
 * @since 0.1.0
 * @category contracts
 */
export const Float64Interval = Schema.Struct({
  lower: Schema.Number.pipe(Schema.finite()),
  upper: Schema.Number.pipe(Schema.finite())
}).pipe(Schema.filter((interval) => N.lessThanOrEqualTo(interval.lower, interval.upper) || "Expected lower <= upper"))

/**
 * BigDecimal interval contract.
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
 * Float64 uncertainty envelope contract.
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
 * BigDecimal uncertainty envelope contract.
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
 * Unified uncertainty envelope authority.
 *
 * @since 0.1.0
 * @category contracts
 */
export const UncertaintyEnvelope = Schema.Union(Float64UncertaintyEnvelope, BigDecimalUncertaintyEnvelope)

/**
 * Unified uncertainty envelope type.
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
 * Uncertainty requirement type.
 *
 * @since 0.1.0
 * @category models
 */
export type UncertaintyRequirementType = typeof UncertaintyRequirement.Type
