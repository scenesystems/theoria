/**
 * Key encapsulation mechanism (KEM) pipeline.
 *
 * Provides hybrid key encapsulation combining classical and
 * post-quantum algorithms.
 *
 * ```
 * Recipient's public key
 *   → encapsulate (X25519 + ML-KEM-768)
 *   → { ciphertext, sharedSecret }
 *
 * Ciphertext + Recipient's secret key
 *   → decapsulate
 *   → sharedSecret (identical)
 * ```
 *
 * The shared secret should be passed through a KDF before use as
 * a symmetric key.
 *
 * **Authentication warning**: KEM is not authenticated by itself.
 * An attacker can substitute their own public key (MITM). Always
 * pair with authenticated identity keys or signatures.
 *
 * @see {@link hybrid} — the underlying XWing algorithm
 * @see {@link agreement} — classical key agreement (X25519 only)
 * @see {@link sign} — digital signature pipeline
 *
 * @since 0.1.0
 * @category kem
 */
