/**
 * Probability-mass schemas and entropy operations.
 *
 * @since 0.1.0
 * @module
 */
import { Chunk, Effect, Schema } from "effect"

import * as PolicyGuard from "./internal/policyGuard.js"
import * as Entropy from "./internal/probability/entropy.js"

const encodeNumber = Schema.encodeSync(Schema.NumberFromString)
const nonNegativeFinite = Schema.Finite.pipe(Schema.nonNegative())

/**
 * Decodes a non-empty array of non-negative finite probability masses into a `Chunk`.
 *
 * @remarks
 * Masses are not normalized and need not sum to one.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Masses = Schema.NonEmptyChunk(nonNegativeFinite).annotations({
  identifier: "@scenesystems/effect-math/Probability/Masses"
})

/**
 * A non-empty collection of non-negative finite probability masses.
 *
 * @since 0.1.0
 * @category models
 */
export type Masses = typeof Masses.Type

/**
 * Accepts masses for validated entropy calculation.
 *
 * @since 0.1.0
 * @category schemas
 */
export const EntropyInput = Schema.Struct({ probabilities: Masses }).annotations({
  identifier: "@scenesystems/effect-math/Probability/EntropyInput"
})

/**
 * Decoded entropy input.
 *
 * @since 0.1.0
 * @category models
 */
export type EntropyInput = typeof EntropyInput.Type

/**
 * Reports malformed input supplied to a validated Probability operation.
 *
 * @since 0.1.0
 * @category errors
 */
export class DecodeError extends Schema.TaggedError<DecodeError>("@scenesystems/effect-math/Probability/DecodeError")(
  "ProbabilityDecodeError",
  {
    operation: Schema.Literal("entropy"),
    message: Schema.String
  }
) {}

/**
 * Reports a non-finite Probability result rejected by strict precision.
 *
 * @since 0.1.0
 * @category errors
 */
export class DomainViolationError
  extends Schema.TaggedError<DomainViolationError>("@scenesystems/effect-math/Probability/DomainViolationError")(
    "ProbabilityDomainViolationError",
    {
      operation: Schema.Literal("entropyWithPolicies"),
      message: Schema.String
    }
  )
{}

/**
 * Recoverable Probability operation failures.
 *
 * @since 0.1.0
 * @category errors
 */
export type OperationError = DecodeError | DomainViolationError

/**
 * Computes `-sum(p * ln(p))` in nats, with zero masses contributing zero.
 *
 * @remarks
 * The input is neither validated nor normalized.
 *
 * @since 0.1.0
 * @category operations
 */
export const entropy: (probabilities: Chunk.Chunk<number>) => number = Entropy.entropy

/**
 * Decodes non-negative finite masses and computes entropy without normalizing them.
 *
 * @since 0.1.0
 * @category operations
 */
export const entropyValidated = (input: unknown) =>
  Schema.decodeUnknown(EntropyInput)(input, { onExcessProperty: "error" }).pipe(
    Effect.mapError((error) => new DecodeError({ operation: "entropy", message: error.message })),
    Effect.map((decoded) => entropy(decoded.probabilities))
  )

/**
 * Computes entropy under configured finite-result and diagnostics policies.
 *
 * @since 0.1.0
 * @category operations
 */
export const entropyWithPolicies = (probabilities: Chunk.Chunk<number>) =>
  PolicyGuard.scalar({
    operation: "Probability.entropyWithPolicies",
    compute: () => entropy(probabilities),
    makeError: (message) => new DomainViolationError({ operation: "entropyWithPolicies", message }),
    annotations: (result) => ({ inputSize: encodeNumber(Chunk.size(probabilities)), result: encodeNumber(result) })
  })
