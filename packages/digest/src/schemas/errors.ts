/**
 * Typed errors for digest operations.
 *
 * All errors are `Schema.TaggedError` — yieldable in `Effect.gen`,
 * catchable via `Effect.catchTag`, serializable via Schema.
 *
 * @see {@link durableFingerprint} — canonical fingerprinting with closed errors
 * @see {@link blake3Mac} — the operation that produces InvalidKeyLength
 *
 * @since 0.1.0
 * @category errors
 */
import { Schema } from "effect"

/**
 * Raised when a MAC key does not meet the required byte length.
 *
 * BLAKE3 keyed mode requires exactly 32 bytes. This error captures
 * the expected and actual lengths for diagnostics.
 *
 * @since 0.1.0
 * @category errors
 */
export class InvalidKeyLength extends Schema.TaggedError<InvalidKeyLength>()(
  "InvalidKeyLength",
  {
    expected: Schema.Number,
    actual: Schema.Number
  }
) {}

/**
 * Raised when text contains an unpaired UTF-16 surrogate.
 *
 * Diagnostics contain only the surrogate kind and absolute code-unit index;
 * rejected text is never retained.
 *
 * @since 0.3.0
 * @category errors
 */
export class InvalidUnicode extends Schema.TaggedError<InvalidUnicode>()(
  "InvalidUnicode",
  {
    kind: Schema.Literal("lone-high-surrogate", "lone-low-surrogate"),
    codeUnitIndex: Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThanOrEqualTo(0)
    )
  }
) {}

/**
 * Raised when canonicalization encounters a value outside the supported
 * plain-data domain.
 *
 * Diagnostics contain only a closed structural reason; rejected values, keys,
 * paths, and preimages are never retained.
 *
 * @since 0.3.0
 * @category errors
 */
export class UnsupportedValue extends Schema.TaggedError<UnsupportedValue>()(
  "UnsupportedValue",
  {
    reason: Schema.Literal(
      "undefined",
      "nan",
      "non-finite-number",
      "bigint",
      "function",
      "symbol",
      "date",
      "regexp",
      "typed-array",
      "map",
      "set",
      "weak-collection",
      "promise",
      "unsupported-prototype",
      "accessor-property",
      "symbol-property",
      "non-enumerable-property",
      "sparse-array",
      "array-extra-property",
      "reflection-failure"
    )
  }
) {}

/**
 * Raised when canonicalization encounters a cyclic object graph.
 *
 * No object identity or traversal path is retained.
 *
 * @since 0.3.0
 * @category errors
 */
export class CyclicValue extends Schema.TaggedError<CyclicValue>()(
  "CyclicValue",
  {}
) {}

/**
 * Raised when canonical UTF-8 bytes exceed a caller's inclusive byte limit.
 *
 * The error is intentionally fieldless: canonical byte lengths, limits, and
 * preimage material are not retained in diagnostics.
 *
 * @since 0.3.3
 * @category errors
 */
export class CanonicalByteLimitExceeded extends Schema.TaggedError<CanonicalByteLimitExceeded>()(
  "CanonicalByteLimitExceeded",
  {}
) {}

/**
 * Raised when a canonical byte limit is not a non-negative safe integer.
 *
 * The error is intentionally fieldless: the rejected limit is not retained in
 * diagnostics.
 *
 * @since 0.3.4
 * @category errors
 */
export class InvalidCanonicalByteLimit extends Schema.TaggedError<InvalidCanonicalByteLimit>()(
  "InvalidCanonicalByteLimit",
  {}
) {}

/**
 * Closed error schema for canonical byte-limit validation and excess.
 *
 * @since 0.3.4
 * @category errors
 */
export const CanonicalByteLimitError = Schema.Union(
  InvalidCanonicalByteLimit,
  CanonicalByteLimitExceeded
)

/**
 * Closed error type for canonical byte limits.
 *
 * @since 0.3.4
 * @category errors
 */
export type CanonicalByteLimitError = Schema.Schema.Type<typeof CanonicalByteLimitError>

/**
 * Closed error schema for strict canonicalization.
 *
 * @since 0.3.0
 * @category errors
 */
export const CanonicalizationError = Schema.Union(
  InvalidUnicode,
  UnsupportedValue,
  CyclicValue
)

/**
 * Closed error type for strict canonicalization.
 *
 * @since 0.3.0
 * @category errors
 */
export type CanonicalizationError = Schema.Schema.Type<
  typeof CanonicalizationError
>
