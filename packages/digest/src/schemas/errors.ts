/**
 * Closed error schemas for strict text encoding, canonicalization, and bounded hashing.
 *
 * @remarks
 * Each variant omits rejected input text and preimage data from its fields.
 *
 * @see {@link durableFingerprint}
 * @see {@link blake3Mac}
 *
 * @since 0.1.0
 * @category errors
 */
import { Schema } from "effect"

/**
 * Reports a BLAKE3 keyed-mode key whose length is not 32 bytes.
 *
 * @remarks
 * Authentication does not begin when this error is returned. `expected` is 32,
 * and `actual` is the supplied key length.
 *
 * @since 0.1.0
 * @category errors
 */
export class InvalidKeyLength extends Schema.TaggedError<InvalidKeyLength>()(
  "InvalidKeyLength",
  {
    /** Required key length in bytes. */
    expected: Schema.Number,
    /** Supplied key length in bytes. */
    actual: Schema.Number
  }
) {}

/**
 * Identifies the first unpaired UTF-16 surrogate without retaining input text.
 *
 * @remarks
 * Diagnostics contain only the surrogate kind and absolute code-unit index;
 * rejected text is never retained.
 *
 * @since 0.3.0
 * @category errors
 */
export class InvalidUnicode extends Schema.TaggedError<InvalidUnicode>()(
  "InvalidUnicode",
  {
    /** Whether the unpaired code unit was a high or low surrogate. */
    kind: Schema.Literal("lone-high-surrogate", "lone-low-surrogate"),
    /** Zero-based UTF-16 code-unit index in the logical input. */
    codeUnitIndex: Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThanOrEqualTo(0)
    )
  }
) {}

/**
 * Classifies why a value is outside the canonical plain-data domain.
 *
 * @remarks
 * Diagnostics contain only a closed structural reason; rejected values, keys,
 * paths, and preimages are never retained.
 *
 * @since 0.3.0
 * @category errors
 */
export class UnsupportedValue extends Schema.TaggedError<UnsupportedValue>()(
  "UnsupportedValue",
  {
    /** Closed structural reason; no rejected input data is included. */
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
 * Signals that canonicalization cannot represent a cyclic object graph.
 *
 * @remarks
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
 * Signals that canonical UTF-8 output crossed the caller's inclusive limit.
 *
 * @remarks
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
 * Rejects a byte limit that is not a non-negative safe integer.
 *
 * @remarks
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
 * Schema for distinguishing invalid limits from admitted values that exceed one.
 *
 * @since 0.3.4
 * @category errors
 */
export const CanonicalByteLimitError = Schema.Union(
  InvalidCanonicalByteLimit,
  CanonicalByteLimitExceeded
)

/**
 * Distinguishes an invalid limit from a canonical preimage that exceeds a valid limit.
 *
 * @since 0.3.4
 * @category errors
 */
export type CanonicalByteLimitError = Schema.Schema.Type<typeof CanonicalByteLimitError>

/**
 * Schema for exhaustive handling of Unicode, domain-admission, and cycle failures.
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
 * Distinguishes malformed Unicode, unsupported structures, and cyclic input.
 *
 * @since 0.3.0
 * @category errors
 */
export type CanonicalizationError = Schema.Schema.Type<
  typeof CanonicalizationError
>
