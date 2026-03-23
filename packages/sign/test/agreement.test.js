/**
 * Key agreement pipeline contract tests.
 *
 * Verifies:
 * - deriveSharedSecret("x25519", ...) produces 32-byte shared secret
 * - Shared secret symmetry (A→B == B→A)
 * - Different key pairs produce different shared secrets
 * - X25519 key pair types are accepted
 * - Signature key pairs are NOT accepted (wrong family)
 * - KEM key pairs are NOT accepted (wrong family)
 */
