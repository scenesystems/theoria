/**
 * Ed25519 EdDSA digital signatures.
 *
 * Primary signature algorithm for content provenance, protocol hash
 * verification, and identity attestation across the Theoria ecosystem.
 *
 * Wraps `@noble/curves/ed25519` — audited (Trail of Bits, Cure53),
 * zero-dependency, ~68K ops/sec for sign, ~34K ops/sec for verify.
 * Ed25519 provides 128-bit security with 32-byte keys and 64-byte
 * signatures.
 *
 * Implements RFC 8032 (Edwards-Curve Digital Signature Algorithm).
 * Deterministic signing — no random nonce required, identical inputs
 * always produce identical signatures. This is critical for
 * reproducible content provenance.
 *
 * Key sizes:
 * - Secret key: 32 bytes (256 bits)
 * - Public key: 32 bytes (256 bits, compressed Edwards point)
 * - Signature: 64 bytes (512 bits)
 *
 * Security property: SUF-CMA (Strong Unforgeability under Chosen
 * Message Attack) — an adversary cannot produce a new valid signature
 * for any message, even one already signed.
 *
 * @see {@link secp256k1} — alternative classical algorithm for Bitcoin/Ethereum compatibility
 * @see {@link mlDsa} — post-quantum alternative (FIPS-204)
 * @see {@link sign} — unified pipeline that dispatches to this algorithm
 *
 * @since 0.1.0
 * @category algorithms
 */
