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
 * Carries `expected` (required key length in bytes) and
 * `received` (actual key length in bytes).
 *
 * @since 0.1.0
 * @category errors
 */
export class InvalidKey extends Schema.TaggedError<InvalidKey>()(
  "InvalidKey",
  {
    expected: Schema.Number,
    received: Schema.Number
  }
) {}
