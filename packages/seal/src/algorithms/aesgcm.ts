/**
 * AES-256-GCM authenticated encryption.
 *
 * Widely deployed AEAD for compatibility with existing systems.
 * NIST-approved, hardware-accelerated on most platforms via AES-NI.
 * Use when interoperability with non-Theoria systems is required.
 *
 * Wraps `@noble/ciphers/aes` — audited, zero-dependency. Uses
 * `managedNonce(aes_256_gcm)` for automatic 12-byte nonce
 * prepending on encrypt and extraction on decrypt.
 *
 * Security properties:
 * - **96-bit nonce**: 12 bytes, randomly generated
 * - **Key wear-out**: 2^32 invocations per key — a hard limit
 *   after which nonce collision probability becomes dangerous.
 *   Rotate keys or use XChaCha20-Poly1305 for high-volume.
 * - **NOT nonce-misuse resistant**: nonce reuse is catastrophic
 *   (reveals plaintext XOR). Use AES-256-GCM-SIV if nonce
 *   management cannot be guaranteed.
 *
 * ⚠️  Prefer {@link xchacha20} unless external compatibility
 * requires AES-GCM specifically.
 *
 * @see {@link keyValidation} — key size constraints
 * @see {@link encoding} — wire format (nonce ‖ ciphertext ‖ tag)
 * @see {@link xchacha20} — recommended default
 * @see {@link aesgcmsiv} — nonce-misuse resistant variant
 * @see {@link seal} — unified pipeline with algorithm selection
 *
 * @since 0.1.0
 * @category algorithms
 */
