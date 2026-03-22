/**
 * Durable fingerprint contract tests (Effect layer).
 *
 * Verifies:
 * - Schema-encoded value fingerprinting
 * - Deterministic output across runs
 * - Unsupported value rejection (undefined, BigInt, Symbol, Date)
 * - Structural key differentiation
 * - Compatibility with effect-search/Cache key semantics
 */
