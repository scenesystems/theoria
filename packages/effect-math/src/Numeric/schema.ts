/**
 * Numeric schema authority — domain model and operation input contracts.
 *
 * @since 0.1.0
 * @category schemas
 */
import { Effect, Schema } from "effect"

import { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"
import { DomainStability } from "../contracts/shared/DomainStability.js"

// ---------------------------------------------------------------------------
// Domain model
// ---------------------------------------------------------------------------

/**
 * Numeric domain model schema.
 *
 * @since 0.1.0
 * @category schemas
 */
export const NumericDomainSchema = Schema.Struct({
  domain: Schema.Literal("Numeric"),
  stability: DomainStability
})

/**
 * Numeric schema-derived type.
 *
 * @since 0.1.0
 * @category models
 */
export type NumericDomain = typeof NumericDomainSchema.Type

/**
 * Decodes unknown boundary input into the canonical numeric domain model.
 *
 * @since 0.1.0
 * @category schemas
 */
export const decodeNumericDomain = (input: unknown) =>
  Schema.decodeUnknown(NumericDomainSchema)(input, {
    onExcessProperty: "error"
  }).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new BoundaryDecodeError({
          domain: "Numeric",
          contract: "NumericDomainSchema",
          message: error.message
        })
      )
    )
  )

/**
 * Encodes the canonical numeric domain model at the package boundary.
 *
 * @since 0.1.0
 * @category schemas
 */
export const encodeNumericDomain = (domain: NumericDomain) =>
  Schema.encode(NumericDomainSchema)(domain).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new BoundaryEncodeError({
          domain: "Numeric",
          contract: "NumericDomainSchema",
          message: error.message
        })
      )
    )
  )

/**
 * Numeric boundary encode/decode errors.
 *
 * @since 0.1.0
 * @category errors
 */
export type NumericSchemaBoundaryError = BoundaryDecodeError | BoundaryEncodeError

// ---------------------------------------------------------------------------
// Operation input schemas — branded scalar governance
// ---------------------------------------------------------------------------

/**
 * Finite scalar — any finite `number`.
 *
 * @since 0.1.0
 * @category schemas
 */
export const FiniteScalar = Schema.Number.pipe(Schema.finite()).annotations({
  identifier: "FiniteScalar"
}).pipe(Schema.brand("FiniteScalar"))

/**
 * Finite positive scalar — finite `number > 0`.
 *
 * @since 0.1.0
 * @category schemas
 */
export const FinitePositiveScalar = Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0)).annotations({
  identifier: "FinitePositiveScalar"
}).pipe(Schema.brand("FinitePositiveScalar"))

/**
 * Finite scalar constrained to `[-1, 1]`.
 *
 * @since 0.3.0
 * @category schemas
 */
export const ClosedUnitScalar = Schema.Number.pipe(
  Schema.finite(),
  Schema.greaterThanOrEqualTo(-1),
  Schema.lessThanOrEqualTo(1)
).annotations({
  identifier: "ClosedUnitScalar"
}).pipe(Schema.brand("ClosedUnitScalar"))

/**
 * Finite scalar constrained to `(-1, 1)`.
 *
 * @since 0.3.0
 * @category schemas
 */
export const OpenUnitScalar = Schema.Number.pipe(
  Schema.finite(),
  Schema.greaterThan(-1),
  Schema.lessThan(1)
).annotations({
  identifier: "OpenUnitScalar"
}).pipe(Schema.brand("OpenUnitScalar"))

/**
 * Finite scalar constrained to `[1, +∞)`.
 *
 * @since 0.3.0
 * @category schemas
 */
export const FiniteScalarAtLeastOne = Schema.Number.pipe(
  Schema.finite(),
  Schema.greaterThanOrEqualTo(1)
).annotations({
  identifier: "FiniteScalarAtLeastOne"
}).pipe(Schema.brand("FiniteScalarAtLeastOne"))

/**
 * Signed 32-bit integer scalar.
 *
 * @since 0.3.0
 * @category schemas
 */
export const Int32Scalar = Schema.Number.pipe(
  Schema.finite(),
  Schema.int(),
  Schema.greaterThanOrEqualTo(-2_147_483_648),
  Schema.lessThanOrEqualTo(2_147_483_647)
).annotations({
  identifier: "Int32Scalar"
}).pipe(Schema.brand("Int32Scalar"))

/**
 * Non-empty finite vector — `ReadonlyArray<FiniteScalar>` with at least one element.
 *
 * @since 0.1.0
 * @category schemas
 */
export const FiniteVector = Schema.NonEmptyArray(Schema.Number.pipe(Schema.finite())).annotations({
  identifier: "FiniteVector"
})

/**
 * Positive finite vector — non-empty array of strictly positive finite numbers.
 *
 * @since 0.1.0
 * @category schemas
 */
export const PositiveFiniteVector = Schema.NonEmptyArray(
  Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0))
).annotations({
  identifier: "PositiveFiniteVector"
})

/**
 * Reusable unary finite-scalar input contract.
 *
 * @since 0.3.0
 * @category schemas
 */
export const UnaryFiniteScalarInput = Schema.Struct({
  value: FiniteScalar
}).annotations({ identifier: "UnaryFiniteScalarInput" })

/**
 * Reusable binary finite-scalar input contract.
 *
 * @since 0.3.0
 * @category schemas
 */
export const BinaryFiniteScalarInput = Schema.Struct({
  left: FiniteScalar,
  right: FiniteScalar
}).annotations({ identifier: "BinaryFiniteScalarInput" })

/**
 * Reusable bounded unary scalar input contract over `[-1, 1]`.
 *
 * @since 0.3.0
 * @category schemas
 */
export const ClosedUnitScalarInput = Schema.Struct({
  value: ClosedUnitScalar
}).annotations({ identifier: "ClosedUnitScalarInput" })

/**
 * Reusable bounded unary scalar input contract over `(-1, 1)`.
 *
 * @since 0.3.0
 * @category schemas
 */
export const OpenUnitScalarInput = Schema.Struct({
  value: OpenUnitScalar
}).annotations({ identifier: "OpenUnitScalarInput" })

/**
 * Reusable bounded unary scalar input contract over `[1, +∞)`.
 *
 * @since 0.3.0
 * @category schemas
 */
export const ScalarAtLeastOneInput = Schema.Struct({
  value: FiniteScalarAtLeastOne
}).annotations({ identifier: "ScalarAtLeastOneInput" })

/**
 * Angle-conversion input contract.
 *
 * @since 0.3.0
 * @category schemas
 */
export const AngleConversionInput = Schema.Struct({
  value: FiniteScalar
}).annotations({ identifier: "AngleConversionInput" })

/**
 * Quadrant-sensitive inverse tangent input contract.
 *
 * @since 0.3.0
 * @category schemas
 */
export const Atan2Input = Schema.Struct({
  y: FiniteScalar,
  x: FiniteScalar
}).annotations({ identifier: "Atan2Input" })

/**
 * Euclidean magnitude input contract.
 *
 * @since 0.3.0
 * @category schemas
 */
export const HypotInput = Schema.Struct({
  left: FiniteScalar,
  right: FiniteScalar
}).annotations({ identifier: "HypotInput" })

/**
 * Deterministic signed 32-bit multiply input contract.
 *
 * @since 0.3.0
 * @category schemas
 */
export const Int32MultiplyInput = Schema.Struct({
  left: Int32Scalar,
  right: Int32Scalar
}).annotations({ identifier: "Int32MultiplyInput" })

/**
 * Division input contract.
 *
 * @since 0.1.0
 * @category schemas
 */
export const DivideInput = Schema.Struct({
  dividend: Schema.Number.pipe(Schema.finite()),
  divisor: Schema.Number.pipe(Schema.finite())
}).annotations({ identifier: "DivideInput" })

/**
 * Log input contract — strictly positive finite scalar.
 *
 * @since 0.1.0
 * @category schemas
 */
export const LogInput = Schema.Struct({
  value: Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0))
}).annotations({ identifier: "LogInput" })

/**
 * Reduction input contract — non-empty finite vector.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ReductionInput = Schema.Struct({
  values: FiniteVector
}).annotations({ identifier: "ReductionInput" })

/**
 * Argmax input contract — non-empty finite vector.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ArgmaxInput = Schema.Struct({
  values: FiniteVector
}).annotations({ identifier: "ArgmaxInput" })

/**
 * Log-add-exp input contract — two finite scalars.
 *
 * @since 0.1.0
 * @category schemas
 */
export const LogaddexpInput = Schema.Struct({
  a: Schema.Number.pipe(Schema.finite()),
  b: Schema.Number.pipe(Schema.finite())
}).annotations({ identifier: "LogaddexpInput" })

/**
 * Log-sum-exp input contract — non-empty finite vector.
 *
 * @since 0.2.0
 * @category schemas
 */
export const LogSumExpInput = Schema.Struct({
  values: FiniteVector
}).annotations({ identifier: "LogSumExpInput" })

/**
 * xlogy input contract — finite x and strictly positive finite y.
 *
 * @since 0.1.0
 * @category schemas
 */
export const XlogyInput = Schema.Struct({
  x: Schema.Number.pipe(Schema.finite()),
  y: Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0))
}).annotations({ identifier: "XlogyInput" })

/**
 * xlog1py input contract — finite x and finite y > -1.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Xlog1pyInput = Schema.Struct({
  x: Schema.Number.pipe(Schema.finite()),
  y: Schema.Number.pipe(Schema.finite(), Schema.greaterThan(-1))
}).annotations({ identifier: "Xlog1pyInput" })
