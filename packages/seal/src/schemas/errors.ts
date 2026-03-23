/**
 * Typed errors for seal operations.
 *
 * All errors are `Schema.TaggedError` — yieldable in `Effect.gen`,
 * catchable via `Effect.catchTag`, serializable via Schema.
 *
 * **`DecryptionFailed`** — raised when authenticated decryption
 * fails. This covers tampered ciphertext, wrong key, corrupted
 * nonce, or truncated envelope. Carries `algorithm` (which AEAD
 * was attempted) and `reason` (human-readable explanation).
 * Intentionally vague to avoid oracle attacks — does not
 * distinguish between wrong key and tampered ciphertext.
 *
 * ```ts
 * class DecryptionFailed extends Schema.TaggedError<
 *   DecryptionFailed
 * >()("DecryptionFailed", {
 *   algorithm: SealAlgorithm,
 *   reason: Schema.String
 * }) {}
 * ```
 *
 * **`InvalidKey`** — raised when key validation fails before
 * encryption or decryption is attempted. Carries `expected`
 * (required key length) and `received` (actual key length).
 *
 * ```ts
 * class InvalidKey extends Schema.TaggedError<
 *   InvalidKey
 * >()("InvalidKey", {
 *   expected: Schema.Number,
 *   received: Schema.Number
 * }) {}
 * ```
 *
 * @see {@link sealEffect} — the operations that produce these errors
 *
 * @since 0.1.0
 * @category errors
 */
