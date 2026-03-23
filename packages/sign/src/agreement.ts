/**
 * Key agreement pipeline.
 *
 * Derives shared secrets using elliptic-curve Diffie–Hellman key
 * agreement. Currently supports X25519 (RFC 7748).
 *
 * ```
 * Party A's secret key + Party B's public key
 *   → algorithm dispatch (X25519)
 *   → 32-byte shared secret
 * ```
 *
 * The shared secret should be passed through a KDF (e.g., HKDF-SHA256
 * or BLAKE3 derive-key mode) before use as a symmetric encryption key.
 *
 * @see {@link x25519} — the underlying key agreement algorithm
 * @see {@link kem} — key encapsulation mechanism (XWing hybrid)
 * @see {@link sign} — digital signature pipeline
 *
 * @since 0.1.0
 * @category agreement
 */
