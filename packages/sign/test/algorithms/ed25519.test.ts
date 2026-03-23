/**
 * Ed25519 algorithm contract tests.
 *
 * Verifies:
 * - Deterministic signing (identical inputs → identical signatures)
 * - 64-byte signature output shape
 * - RFC 8032 known test vector correctness
 * - Sign → verify roundtrip for random messages
 * - Invalid signature rejection
 * - Wrong public key rejection
 * - Empty message signing and verification
 */
