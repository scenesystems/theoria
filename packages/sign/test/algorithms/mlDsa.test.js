/**
 * ML-DSA (Dilithium, FIPS-204) contract tests.
 *
 * Verifies:
 * - ML-DSA-44 sign → verify roundtrip
 * - ML-DSA-65 sign → verify roundtrip (primary)
 * - ML-DSA-87 sign → verify roundtrip
 * - Expected key sizes (1312B/2560B for ML-DSA-44, etc.)
 * - Expected signature sizes (2420B, 3309B, 4627B)
 * - Deterministic signing (same message + key → same signature)
 * - Invalid signature rejection
 * - Wrong public key rejection
 * - NIST ACVP test vectors when available
 */
