/**
 * SLH-DSA (SPHINCS+, FIPS-205) contract tests.
 *
 * Verifies:
 * - SLH-DSA-SHA2-128f sign → verify roundtrip
 * - SLH-DSA-SHA2-128s sign → verify roundtrip (smaller signatures)
 * - Expected key sizes (32B pk, 64B sk for 128-bit level)
 * - Expected signature sizes (17088B for 128f, 7856B for 128s)
 * - Invalid signature rejection
 * - Wrong public key rejection
 * - Stateless property (no counter management required)
 * - NIST ACVP test vectors when available
 */
