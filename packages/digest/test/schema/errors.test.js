/**
 * Error model contract tests (Effect layer).
 *
 * Verifies:
 * - FingerprintUnsupportedValue is yieldable in Effect.gen
 * - Error is catchable via Effect.catchTag
 * - Error carries valueType and reason fields
 * - Error is Schema-serializable
 */
