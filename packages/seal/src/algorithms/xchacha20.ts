/**
 * XChaCha20-Poly1305 authenticated encryption.
 *
 * Recommended default AEAD for all Theoria encryption use cases.
 * XChaCha20-Poly1305 extends ChaCha20-Poly1305 with a 192-bit
 * (24-byte) nonce — large enough for safe random generation without
 * nonce management infrastructure.
 *
 * Wraps `@noble/ciphers/chacha` — audited, zero-dependency. Uses
 * `managedNonce(xchacha20poly1305)` for automatic nonce prepending
 * on encrypt and extraction on decrypt.
 *
 * Security properties:
 * - **192-bit random nonce**: no counter needed, safe for
 *   `crypto.getRandomValues` — birthday bound at 2^96 messages
 * - **Unlimited key wear-out**: no practical message count limit
 *   (unlike AES-GCM's 2^32 invocations per key)
 * - **AEAD**: ciphertext integrity and authenticity guaranteed
 *
 * @see {@link keyValidation} — key size constraints
 * @see {@link encoding} — wire format (nonce ‖ ciphertext ‖ tag)
 * @see {@link aesgcmsiv} — nonce-misuse resistant alternative
 * @see {@link aesgcm} — compatibility alternative
 * @see {@link seal} — unified pipeline with algorithm selection
 *
 * @since 0.1.0
 * @category algorithms
 */
