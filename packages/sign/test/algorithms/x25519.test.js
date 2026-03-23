/**
 * X25519 ECDH key agreement contract tests.
 *
 * Verifies:
 * - Shared secret symmetry (A→B == B→A)
 * - RFC 7748 known test vector correctness
 * - 32-byte shared secret output shape
 * - Different key pairs produce different shared secrets
 * - Key pair generation produces valid 32-byte keys
 * - Shared secret is not all zeros (low-order point rejection)
 */
