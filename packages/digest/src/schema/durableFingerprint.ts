/**
 * Deterministic, durable fingerprint for cache key identity.
 *
 * Composes RFC 8785 JCS canonicalization with BLAKE3-256 digestion
 * and base64url encoding. Produces algorithm-tagged strings
 * (`blake3-256:<base64url>`) suitable for persisted cache keys.
 *
 * This is the canonical fingerprinting function consumed by
 * `effect-search/Cache` and `effect-dsp/Cache`.
 *
 * @since 0.1.0
 * @category fingerprint
 */
