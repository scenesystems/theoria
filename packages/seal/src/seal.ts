/**
 * Unified encrypt/decrypt pipeline.
 *
 * Composes the full authenticated encryption pipeline in a single
 * call with algorithm selection:
 *
 * ```
 * Plaintext (Uint8Array)
 *   → select algorithm
 *   → validate key
 *   → generate nonce
 *   → encrypt with AEAD (managedNonce handles nonce prepending)
 *   → encode as SealedEnvelope
 * ```
 *
 * Decryption reverses the process:
 *
 * ```
 * SealedEnvelope
 *   → decode envelope (extract algorithm, nonce, ciphertext + tag)
 *   → select algorithm
 *   → validate key
 *   → decrypt with AEAD (managedNonce extracts prepended nonce)
 *   → Plaintext (Uint8Array)
 * ```
 *
 * The `seal` function always produces a `SealedEnvelope` containing
 * the algorithm identifier, enabling `unseal` to select the correct
 * cipher automatically.
 *
 * @see {@link SealAlgorithm} — algorithm union schema
 * @see {@link xchacha20} — recommended AEAD algorithm
 * @see {@link aesgcmsiv} — nonce-misuse resistant alternative
 * @see {@link aesgcm} — compatibility alternative
 * @see {@link SealedEnvelope} — output envelope type
 *
 * @since 0.1.0
 * @category seal
 */
