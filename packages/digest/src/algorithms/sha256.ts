/**
 * SHA-256 content hashing.
 *
 * Secondary digest algorithm for secrets (API key hashing),
 * external protocol compatibility (webhooks), and regulatory
 * contexts where FIPS familiarity matters.
 *
 * Accepts UTF-8 strings or raw byte arrays. Returns 43-character
 * base64url digest (256-bit, no padding).
 *
 * @since 0.1.0
 * @category algorithms
 */
