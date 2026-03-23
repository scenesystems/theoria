/**
 * Supported key agreement algorithms as a Schema literal union.
 *
 * ```ts
 * const AgreementAlgorithm = Schema.Literal("x25519")
 * ```
 *
 * `"x25519"` is the only classical key agreement algorithm.
 * X25519 provides 128-bit classical security via ECDH on
 * Curve25519 (RFC 7748).
 *
 * @see {@link AgreementKeyPair} — key pair tagged by this algorithm
 * @see {@link SharedSecret} — output of key agreement
 * @see {@link SignatureAlgorithm} — separate union for signature algorithms
 * @see {@link KemAlgorithm} — separate union for KEM algorithms
 *
 * @since 0.1.0
 * @category schemas
 */
