/**
 * Typed errors for digest operations.
 *
 * All errors are `Schema.TaggedError` — yieldable in `Effect.gen`,
 * catchable via `Effect.catchTag`, serializable via Schema.
 *
 * @see {@link durableFingerprint} — the operation that produces FingerprintUnsupportedValue
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
 * Raised when `durableFingerprint` encounters a value that cannot
 * participate in deterministic canonicalization.
 *
 * @since 0.1.0
 * @category errors
 */
export class FingerprintUnsupportedValue extends Schema.TaggedError<FingerprintUnsupportedValue>()(
  "FingerprintUnsupportedValue",
  {
    valueType: Schema.String,
    reason: Schema.String
  }
) {}

/**
 * Raised when text contains an unpaired UTF-16 surrogate.
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
 * @since 0.3.0
 * @category errors
 */
export class CyclicValue extends Schema.TaggedError<CyclicValue>()(
  "CyclicValue",
  {}
) {}

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
