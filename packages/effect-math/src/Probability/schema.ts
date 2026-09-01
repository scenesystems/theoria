/**
 * Schema authority for the Probability domain — defines the canonical
 * domain discriminator, distribution parameter contracts, and operation
 * input schemas. All schemas enforce finite-number validation at decode
 * time, so kernels can assume well-formed numeric input.
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
 * Descriptor schema used to advertise Probability density, CDF, and entropy
 * support in domain-discovery results.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ProbabilityDomainSchema = Schema.Struct({
  domain: Schema.Literal("Probability"),
  stability: DomainStability
})

/**
 * Validated descriptor for the Probability operation domain.
 *
 * @since 0.1.0
 * @category models
 */
export type ProbabilityDomain = typeof ProbabilityDomainSchema.Type

/**
 * Decodes a Probability discovery descriptor and rejects unknown fields.
 *
 * @since 0.1.0
 * @category schemas
 */
export const decodeProbabilityDomain = (input: unknown) =>
  Schema.decodeUnknown(ProbabilityDomainSchema)(input, {
    onExcessProperty: "error"
  }).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new BoundaryDecodeError({
          domain: "Probability",
          contract: "ProbabilityDomainSchema",
          message: error.message
        })
      )
    )
  )

/**
 * Encodes a validated Probability discovery descriptor, failing for forged values.
 *
 * @since 0.1.0
 * @category schemas
 */
export const encodeProbabilityDomain = (domain: ProbabilityDomain) =>
  Schema.encode(ProbabilityDomainSchema)(domain).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new BoundaryEncodeError({
          domain: "Probability",
          contract: "ProbabilityDomainSchema",
          message: error.message
        })
      )
    )
  )

/**
 * Decode failures for unknown input or encode failures for forged Probability descriptors.
 *
 * @since 0.1.0
 * @category errors
 */
export type ProbabilitySchemaBoundaryError = BoundaryDecodeError | BoundaryEncodeError

// ---------------------------------------------------------------------------
// Shared finite number schemas
// ---------------------------------------------------------------------------

const FiniteNumber = Schema.Number.pipe(Schema.finite())
const PositiveFiniteNumber = Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0))

// ---------------------------------------------------------------------------
// Distribution parameter schemas
// ---------------------------------------------------------------------------

/**
 * Validates parameters accepted by the Probability domain's Normal PDF and CDF
 * operations.
 *
 * @since 0.1.0
 * @category schemas
 */
export const NormalParams = Schema.Struct({
  mu: FiniteNumber,
  sigma: PositiveFiniteNumber
}).annotations({ identifier: "NormalParams" })

/**
 * Validates finite bounds accepted by the Probability domain's Uniform PDF and
 * CDF operations.
 *
 * @remarks
 * The `high > low` invariant remains operation-specific so callers receive a
 * probability error rather than a Schema parse issue.
 *
 * @since 0.1.0
 * @category schemas
 */
export const UniformParams = Schema.Struct({
  low: FiniteNumber,
  high: FiniteNumber
}).annotations({ identifier: "UniformParams" })

// ---------------------------------------------------------------------------
// Operation input schemas
// ---------------------------------------------------------------------------

/**
 * Evaluates a finite point under a normal distribution with finite location and
 * strictly positive finite scale.
 *
 * @since 0.1.0
 * @category schemas
 */
export const NormalEvalInput = Schema.Struct({
  x: FiniteNumber,
  mu: FiniteNumber,
  sigma: PositiveFiniteNumber
}).annotations({ identifier: "NormalEvalInput" })

/**
 * Evaluates a finite point under finite uniform bounds. Decoding does not prove
 * `low < high`; validated operations report that as `ProbabilityParameterError`.
 *
 * @since 0.1.0
 * @category schemas
 */
export const UniformEvalInput = Schema.Struct({
  x: FiniteNumber,
  low: FiniteNumber,
  high: FiniteNumber
}).annotations({ identifier: "UniformEvalInput" })

/**
 * Selects normal or uniform PDF/CDF evaluation at a finite point. Parameter
 * values are finite and normal scale is positive, but this schema does not
 * correlate the `distribution` literal with a parameter variant or require
 * ordered uniform bounds.
 *
 * @since 0.1.0
 * @category schemas
 */
export const DistributionEvalInput = Schema.Struct({
  x: FiniteNumber,
  distribution: Schema.Literal("normal", "uniform"),
  params: Schema.Union(
    Schema.Struct({
      mu: FiniteNumber,
      sigma: PositiveFiniteNumber
    }),
    Schema.Struct({
      low: FiniteNumber,
      high: FiniteNumber
    })
  )
}).annotations({ identifier: "DistributionEvalInput" })

/**
 * Probability vector — a non-empty array of non-negative finite numbers.
 * The sum-to-1 invariant is enforced at the operation level, not at the
 * schema level, to produce domain-specific errors.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ProbabilityVector = Schema.NonEmptyArray(
  Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0))
).annotations({ identifier: "ProbabilityVector" })

/**
 * Entropy input: a probability vector for Shannon entropy computation.
 *
 * @since 0.1.0
 * @category schemas
 */
export const EntropyInput = Schema.Struct({
  probabilities: ProbabilityVector
}).annotations({ identifier: "EntropyInput" })
