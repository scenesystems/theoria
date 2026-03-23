/**
 * secp256k1 ECDSA and Schnorr contract tests.
 *
 * Verifies:
 * - ECDSA sign → verify roundtrip
 * - Schnorr (BIP-340) sign → verify roundtrip
 * - BIP-340 known test vector correctness
 * - Compressed vs uncompressed public key handling
 * - RFC 6979 deterministic k-generation (ECDSA)
 * - Invalid signature rejection for both schemes
 * - DER encoding correctness for ECDSA signatures
 */
