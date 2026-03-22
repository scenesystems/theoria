/**
 * RFC 8785 JSON Canonicalization Scheme (JCS).
 *
 * Deterministic JSON serialization guaranteeing cross-language byte
 * identity. Object keys are sorted lexicographically by UTF-16 code
 * units. Numbers use ES2015 canonical representation. No whitespace.
 * No BOM.
 *
 * This is the sole canonicalization strategy for all structured data
 * hashing across the ecosystem — `effect-search` cache keys,
 * `effect-dsp` signature fingerprints, and content-addressing.
 *
 * @see https://www.rfc-editor.org/rfc/rfc8785
 *
 * @since 0.1.0
 * @category canonicalization
 */
