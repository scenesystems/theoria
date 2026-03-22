/**
 * BLAKE3-256 content hashing.
 *
 * Primary digest algorithm for all content-addressing, artifact
 * integrity, and persisted cache identity across the Theoria ecosystem.
 *
 * Accepts UTF-8 strings or raw byte arrays. Returns 43-character
 * base64url digest (256-bit, no padding).
 *
 * @since 0.1.0
 * @category algorithms
 */
