/**
 * Unified digest pipeline.
 *
 * Composes the full content-addressing pipeline in a single call:
 *
 * ```
 * Structured Value
 *   → canonicalize
 *   → UTF-8 encode
 *   → hash
 *   → base64url encode
 * ```
 *
 * Supports algorithm-tagged output strings for self-describing
 * persistence: `"<algorithm>:<base64url>"`.
 *
 * BLAKE3 context mode is used for domain separation when a context
 * string is provided — this leverages BLAKE3's native KDF rather
 * than manual salt concatenation.
 *
 * @see {@link canonicalize} — first stage: deterministic JSON serialization
 * @see {@link blake3Hash} — primary hash function
 * @see {@link sha256} — secondary hash function
 * @see {@link toBase64Url} — final stage: byte-to-string encoding
 * @see {@link DigestAlgorithm} — supported algorithm literals
 * @see {@link Digest256} — output digest shape
 *
 * @since 0.1.0
 * @category digest
 */
