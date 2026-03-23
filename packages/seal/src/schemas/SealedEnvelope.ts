/**
 * Schema-validated sealed envelope.
 *
 * `Schema.Class` representing an authenticated encryption output.
 * Contains the algorithm identifier, base64url-encoded nonce, and
 * base64url-encoded ciphertext (which includes the authentication
 * tag as appended by `@noble/ciphers`).
 *
 * ```ts
 * class SealedEnvelope extends Schema.Class<SealedEnvelope>("SealedEnvelope")({
 *   algorithm: SealAlgorithm,
 *   nonce: Schema.String,       // base64url-encoded nonce
 *   ciphertext: Schema.String,  // base64url-encoded ciphertext + tag
 * }) {}
 * ```
 *
 * The envelope is self-describing — the `algorithm` field determines
 * the nonce length and cipher used for decryption. This enables
 * algorithm-agnostic storage and key rotation workflows.
 *
 * Serializable via `Schema.encode` for JSON persistence (encrypted
 * study snapshots, encrypted cache entries, encrypted DSP modules).
 *
 * @see {@link SealAlgorithm} — the algorithm field schema
 * @see {@link sealEffect} — produces and consumes envelopes
 * @see {@link seal} in `seal.ts` — core layer equivalent
 *
 * @since 0.1.0
 * @category schemas
 */
