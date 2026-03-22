/**
 * SHA-256 algorithm contract tests.
 *
 * Verifies:
 * - Deterministic output for identical inputs
 * - 43-character base64url output shape
 * - NIST test vector correctness (FIPS 180-4)
 * - Divergence from BLAKE3 output for same input
 */
