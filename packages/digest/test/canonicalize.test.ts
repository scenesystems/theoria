/**
 * RFC 8785 JCS canonicalization contract tests.
 *
 * Verifies:
 * - Deterministic key ordering (lexicographic by UTF-16 code units)
 * - ES2015 number canonical representation
 * - Nested object/array recursion
 * - Null handling
 * - Unicode key sorting
 * - RFC 8785 test vectors from specification
 */
