/**
 * AES-256-GCM-SIV authenticated encryption.
 *
 * Nonce-misuse resistant AEAD — if a nonce is accidentally reused,
 * only the ability to detect repeated messages is lost; ciphertext
 * integrity and confidentiality are preserved. Preferred when nonce
 * management cannot be guaranteed (e.g. distributed systems).
 *
 * Wraps `@noble/ciphers/aes` — audited, zero-dependency. Uses
 * `managedNonce(siv(aes_256_gcm))` for automatic 12-byte nonce
 * prepending on encrypt and extraction on decrypt.
 *
 * Security properties:
 * - **Nonce-misuse resistance**: SIV construction derives the tag
 *   from both nonce and plaintext, so repeated (nonce, plaintext)
 *   only reveals equality — no catastrophic failure
 * - **96-bit nonce**: 12 bytes, randomly generated
 * - **Key wear-out**: ~2^48 messages per key (SIV mitigates but
 *   does not eliminate birthday bound concerns)
 *
 * @see {@link keyValidation} — key size constraints
 * @see {@link encoding} — wire format (nonce ‖ ciphertext ‖ tag)
 * @see {@link xchacha20} — recommended default with larger nonce
 * @see {@link aesgcm} — non-SIV variant for compatibility
 * @see {@link seal} — unified pipeline with algorithm selection
 *
 * @since 0.1.0
 * @category algorithms
 */
