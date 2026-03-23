/**
 * HMAC message authentication code tests.
 *
 * Verifies:
 * - HMAC-SHA256 golden vectors from RFC 4231 (test cases 1–4)
 * - HMAC-SHA1 golden vectors from RFC 2202
 * - Output length: 32 bytes for SHA-256, 20 bytes for SHA-1
 * - Uint8Array input/output shape contract
 * - Different keys produce different MACs for same message
 * - Different messages produce different MACs for same key
 * - Empty message produces valid MAC
 * - Key length independence (short keys padded, long keys hashed)
 */
