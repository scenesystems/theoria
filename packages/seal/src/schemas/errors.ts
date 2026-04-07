/**
 * Typed errors for seal operations.
 *
 * All errors are `Schema.TaggedError` — yieldable in `Effect.gen`,
 * catchable via `Effect.catchTag`, serializable via Schema.
 *
 * **`DecryptionFailed`** — raised when authenticated decryption
 * fails. Covers tampered ciphertext, wrong key, corrupted nonce,
 * or truncated envelope. Intentionally vague to avoid oracle
 * attacks — does not distinguish between wrong key and tampered
 * ciphertext.
 *
 * **`InvalidKey`** — raised when key validation fails before
 * encryption or decryption is attempted. Carries expected and
 * received key lengths for diagnostics.
 *
 * **`InvalidAssociatedData`** — raised when associated data is
 * provided in an invalid runtime form before encryption or decryption
 * is attempted.
 *
 * @see {@link seal} — encrypt operation that produces these errors
 * @see {@link unseal} — decrypt operation that produces these errors
 * @see {@link SealAlgorithm} — algorithm field on DecryptionFailed
 *
 * @since 0.1.0
 * @category errors
 */
import { Schema } from "effect"
import { SealAlgorithm } from "./SealAlgorithm.js"

/**
 * Authenticated decryption failed.
 *
 * Carries `algorithm` (which AEAD was attempted) and `reason`
 * (human-readable explanation). Intentionally vague — does not
 * distinguish between wrong key and tampered ciphertext.
 *
 * @since 0.1.0
 * @category errors
 */
export class DecryptionFailed extends Schema.TaggedError<DecryptionFailed>()(
  "DecryptionFailed",
  {
    algorithm: SealAlgorithm,
    reason: Schema.String
  }
) {}

/**
 * Key validation failed before encryption or decryption.
 *
 * Carries `expected` (required key length in bytes),
 * `received` (actual key length in bytes), and `reason`
 * (human-readable explanation of the failure).
 *
 * @since 0.1.0
 * @category errors
 */
export class InvalidKey extends Schema.TaggedError<InvalidKey>()(
  "InvalidKey",
  {
    expected: Schema.Number,
    received: Schema.Number,
    reason: Schema.String
  }
) {}

/**
 * Associated-data validation failed before encryption or decryption.
 *
 * Carries the attempted `algorithm` together with a human-readable `reason`
 * so protocol-bound AAD failures stay typed and algorithm-scoped.
 *
 * @since 0.2.0
 * @category errors
 */
export class InvalidAssociatedData extends Schema.TaggedError<InvalidAssociatedData>()(
  "InvalidAssociatedData",
  {
    algorithm: SealAlgorithm,
    reason: Schema.String
  }
) {}
