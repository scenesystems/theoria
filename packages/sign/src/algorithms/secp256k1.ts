/**
 * secp256k1 ECDSA and Schnorr (BIP-340) signatures.
 *
 * Secondary classical signature algorithm for Bitcoin, Ethereum, and
 * blockchain-adjacent protocol compatibility.
 *
 * Wraps `@noble/curves/secp256k1` — audited (Trail of Bits, Cure53),
 * zero-dependency. Provides both ECDSA (traditional) and Schnorr
 * (BIP-340) signature schemes on the secp256k1 curve.
 *
 * ECDSA: non-deterministic by default, but uses RFC 6979 deterministic
 * k-generation for reproducibility. Signatures are DER-encoded
 * (70–72 bytes) or compact (64 bytes, r‖s).
 *
 * Schnorr (BIP-340): simpler, provably secure, supports batch
 * verification. 64-byte signatures with 32-byte x-only public keys.
 * Preferred over ECDSA for new designs — enables FROST threshold
 * signatures and MuSig2 multi-signatures.
 *
 * Key sizes:
 * - Secret key: 32 bytes (256 bits)
 * - Public key: 33 bytes (compressed) or 65 bytes (uncompressed)
 * - Schnorr public key: 32 bytes (x-only)
 * - Signature: 64 bytes (Schnorr) or 70–72 bytes (ECDSA DER)
 *
 * Security property: 128-bit classical security. EUF-CMA for ECDSA,
 * SUF-CMA for Schnorr.
 *
 * @see {@link ed25519} — primary algorithm, preferred for new designs
 * @see {@link hybrid} — post-quantum protection via hybrid wrapping
 * @see {@link sign} — unified pipeline that dispatches to this algorithm
 *
 * @since 0.1.0
 * @category algorithms
 */
