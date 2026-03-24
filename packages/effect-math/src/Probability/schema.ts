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
 * Canonical domain discriminator for Probability. Consumers use this to
 * identify which domain produced a result when multiple domains coexist in
 * the same pipeline. The `stability` field tracks the domain's maturity level.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ProbabilityDomainSchema = Schema.Struct({
  domain: Schema.Literal("Probability"),
  stability: DomainStability
})

/**
 * Extracted type of a decoded `ProbabilityDomainSchema` — use this in
 * function signatures that accept an already-validated domain descriptor.
 *
 * @since 0.1.0
 * @category models
 */
export type ProbabilityDomain = typeof ProbabilityDomainSchema.Type

/**
 * Decodes unknown boundary input into the canonical probability domain model.
 * Uses strict excess-property checking — any properties beyond `domain` and
 * `stability` cause a `BoundaryDecodeError`. Use at package edges where
 * untrusted input enters the domain.
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
 * Encodes a validated `ProbabilityDomain` back to its serializable form at
 * the package boundary. Failures surface as `BoundaryEncodeError` — this
 * should only happen if the domain value was constructed outside of Schema.
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
 * Probability boundary encode/decode errors.
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
 * Normal distribution parameters: mean (mu) and standard deviation (sigma).
 * Sigma must be strictly positive and finite.
 *
 * @since 0.1.0
 * @category schemas
 */
export const NormalParams = Schema.Struct({
  mu: FiniteNumber,
  sigma: PositiveFiniteNumber
}).annotations({ identifier: "NormalParams" })

/**
 * Uniform distribution parameters: lower and upper bounds.
 * Both must be finite. The `high > low` invariant is enforced at the
 * operation level, not at the schema level, to produce domain-specific errors.
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
 * Point evaluation input for normal distribution PDF/CDF.
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
 * Point evaluation input for uniform distribution PDF/CDF.
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
 * Discriminated union input for PDF/CDF evaluation across distribution families.
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
