/**
 * HKDF key derivation function tests.
 *
 * Verifies:
 * - HKDF-SHA256 golden vectors from RFC 5869 (test cases 1–3)
 * - HKDF-SHA512 golden vectors from RFC 5869 (test case 4+)
 * - Output length parameterization (dkLen respected exactly)
 * - Domain separation: different info strings produce different keys
 * - Salt handling: absent salt defaults to hash-length zero bytes
 * - Empty IKM rejection or defined behavior
 * - Deterministic: same inputs always produce same derived key
 * - Maximum output length enforcement (255 × hash length per RFC)
 */
