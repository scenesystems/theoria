/**
 * Unified digest pipeline.
 *
 * Composes canonicalization → UTF-8 encoding → algorithm → base64url
 * into a single operation. Supports algorithm-tagged output strings
 * (`blake3-256:<base64url>`) for self-describing persistence.
 *
 * @since 0.1.0
 * @category digest
 */
