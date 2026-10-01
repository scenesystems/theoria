/**
 * Defines scalar-specific intervals and uncertainty envelopes.
 *
 * @since 0.1.0
 * @module
 */
import { BigDecimal, Boolean, Number, Schema } from "effect"

import * as Scalar from "./Scalar.js"

const NonNegativeFiniteNumber = Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0))
const NonNegativeBigDecimal = Schema.BigDecimal.pipe(Schema.nonNegativeBigDecimal())
const Float64Kind = Scalar.Kind.pipe(Schema.pickLiteral("float64"))
const BigDecimalKind = Scalar.Kind.pipe(Schema.pickLiteral("bigdecimal"))
const ordered = (isOrdered: boolean, message: string) =>
  Boolean.match(isOrdered, { onFalse: () => message, onTrue: () => true })

/**
 * Accepts finite Float64 interval bounds ordered as `lower <= upper`.
 *
 * Both encoded and decoded endpoints are JavaScript numbers.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Float64Interval = Schema.Struct({
  lower: Schema.Number.pipe(Schema.finite()),
  upper: Schema.Number.pipe(Schema.finite())
}).pipe(
  Schema.filter((interval) =>
    ordered(Number.lessThanOrEqualTo(interval.lower, interval.upper), "Expected lower <= upper")
  )
).annotations({ identifier: "@scenesystems/effect-math/Uncertainty/Float64Interval" })

/**
 * A decoded ordered interval with finite Float64 endpoints.
 *
 * @since 0.1.0
 * @category models
 */
export type Float64Interval = typeof Float64Interval.Type

/**
 * Accepts decimal-string interval bounds ordered as `lower <= upper`.
 *
 * Decoding converts strings to normalized `BigDecimal` values. Encoding emits
 * canonical decimal strings rather than `BigDecimal` objects.
 *
 * @since 0.1.0
 * @category schemas
 */
export const BigDecimalInterval = Schema.Struct({
  lower: Schema.BigDecimal,
  upper: Schema.BigDecimal
}).pipe(
  Schema.filter((interval) =>
    ordered(BigDecimal.lessThanOrEqualTo(interval.lower, interval.upper), "Expected lower <= upper")
  )
).annotations({ identifier: "@scenesystems/effect-math/Uncertainty/BigDecimalInterval" })

/**
 * A decoded ordered interval with `BigDecimal` endpoints.
 *
 * @since 0.1.0
 * @category models
 */
export type BigDecimalInterval = typeof BigDecimalInterval.Type

/**
 * Accepts a finite Float64 estimate with non-negative finite error bounds.
 *
 * Absolute error and interval endpoints use the estimate's units; relative
 * error is unitless. An optional interval must be ordered, but need not contain
 * `value` or agree with either error field.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Float64Envelope = Schema.Struct({
  scalarKind: Float64Kind,
  value: Schema.Number.pipe(Schema.finite()),
  absoluteError: NonNegativeFiniteNumber,
  relativeError: NonNegativeFiniteNumber,
  interval: Schema.optional(Float64Interval)
}).annotations({ identifier: "@scenesystems/effect-math/Uncertainty/Float64Envelope" })

/**
 * A decoded Float64 estimate, errors, and optional interval.
 *
 * @since 0.1.0
 * @category models
 */
export type Float64Envelope = typeof Float64Envelope.Type

/**
 * Accepts a BigDecimal estimate with non-negative BigDecimal error bounds.
 *
 * Every encoded numeric field is a decimal string. Decoding produces
 * normalized `BigDecimal` values; encoding returns canonical decimal strings.
 * Absolute error and interval endpoints use the estimate's units, while
 * relative error is unitless. The ordered interval need not contain `value` or
 * agree with either error field.
 *
 * @since 0.1.0
 * @category schemas
 */
export const BigDecimalEnvelope = Schema.Struct({
  scalarKind: BigDecimalKind,
  value: Schema.BigDecimal,
  absoluteError: NonNegativeBigDecimal,
  relativeError: NonNegativeBigDecimal,
  interval: Schema.optional(BigDecimalInterval)
}).annotations({ identifier: "@scenesystems/effect-math/Uncertainty/BigDecimalEnvelope" })

/**
 * A decoded BigDecimal estimate, errors, and optional interval.
 *
 * @since 0.1.0
 * @category models
 */
export type BigDecimalEnvelope = typeof BigDecimalEnvelope.Type

/**
 * Accepts a scalar-consistent Float64 or BigDecimal uncertainty envelope.
 *
 * `scalarKind` selects the branch and therefore the encoded and decoded
 * representation of every value, error, and interval endpoint.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Envelope = Schema.Union(Float64Envelope, BigDecimalEnvelope).annotations({
  identifier: "@scenesystems/effect-math/Uncertainty/Envelope"
})

/**
 * A decoded estimate whose values and errors share one scalar representation.
 *
 * @since 0.1.0
 * @category models
 */
export type Envelope = typeof Envelope.Type
