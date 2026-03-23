/**
 * Key generation and key pair management contract tests.
 *
 * Verifies:
 * - generateKeyPair("ed25519") produces 32B keys
 * - generateKeyPair("ml-dsa-65") produces correct-size PQ keys
 * - generateKeyPair("x25519") produces 32B agreement keys
 * - generateKeyPair("xwing") produces correct-size KEM keys
 * - Generated signature key pairs are functional (sign → verify roundtrip)
 * - Generated agreement key pairs are functional (shared secret symmetry)
 * - Each call produces unique key pairs (CSPRNG)
 * - Key pair carries correct algorithm discriminant
 * - Unknown algorithm produces descriptive error
 * - Key sizes match algorithm specifications
 */
