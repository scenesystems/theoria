/**
 * Runtime schemas for Numeric metadata and validated operation inputs.
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
 * Accepts only the `"Numeric"` discovery discriminator and a known stability value.
 *
 * @since 0.1.0
 * @category schemas
 */
export const NumericDomainSchema = Schema.Struct({
  domain: Schema.Literal("Numeric"),
  stability: DomainStability
})

/**
 * Discovery metadata identifying scalar and vector numeric primitives in a
 * recognized stability lane.
 *
 * @since 0.1.0
 * @category models
 */
export type NumericDomain = typeof NumericDomainSchema.Type

/**
 * Establishes the `"Numeric"` discriminator and stability lane at an untrusted
 * discovery boundary. Malformed or additional fields fail with
 * {@link BoundaryDecodeError}.
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
 * Decode failures for unknown input or encode failures for forged Numeric descriptors.
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
 * Two finite operands; zero-divisor handling remains the selected operation's boundary.
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
