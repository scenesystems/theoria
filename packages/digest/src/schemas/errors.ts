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
