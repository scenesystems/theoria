/**
 * Nonce size constants per algorithm.
 *
 * Used by the encoding module to split `managedNonce` output into
 * nonce and ciphertext components. Nonce generation itself is
 * handled by `@noble/ciphers` `managedNonce` wrapper — no manual
 * nonce management needed.
 *
 * @see {@link xchacha20Encrypt} — 24-byte nonce (192-bit)
 * @see {@link aesgcmsivEncrypt} — 12-byte nonce (96-bit)
 * @see {@link aesgcmEncrypt} — 12-byte nonce (96-bit)
 *
 * @internal
 */

/**
 * XChaCha20-Poly1305 nonce size in bytes (192-bit).
 *
 * @internal
 */
export const XCHACHA20_NONCE_BYTES = 24

/**
 * AES-GCM and AES-GCM-SIV nonce size in bytes (96-bit).
 *
 * @internal
 */
export const AES_GCM_NONCE_BYTES = 12
