/**
 * Schema.TaggedError tests for seal errors.
 *
 * Verifies:
 * - DecryptionFailed is yieldable in Effect.gen
 * - DecryptionFailed is catchable via Effect.catchTag
 * - DecryptionFailed carries algorithm and reason fields
 * - DecryptionFailed is serializable via Schema.encode
 * - InvalidKey is yieldable in Effect.gen
 * - InvalidKey is catchable via Effect.catchTag
 * - InvalidKey carries expected and received fields
 * - InvalidKey is serializable via Schema.encode
 * - Both errors have correct _tag discrimination
 */
