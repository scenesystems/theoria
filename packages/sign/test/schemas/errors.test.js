/**
 * Error model contract tests (Effect layer).
 *
 * Verifies:
 * - VerificationFailed is yieldable in Effect.gen
 * - VerificationFailed is catchable via Effect.catchTag
 * - VerificationFailed carries algorithm and reason fields
 * - InvalidSignature is yieldable in Effect.gen
 * - InvalidSignature is catchable via Effect.catchTag
 * - KeyGenerationFailed is yieldable in Effect.gen
 * - All errors are Schema-serializable
 * - Error _tag matches class name
 */
