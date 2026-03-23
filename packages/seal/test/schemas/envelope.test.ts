/**
 * SealedEnvelope schema tests.
 *
 * Verifies:
 * - Schema.decode accepts valid envelope shapes
 * - Schema.decode rejects missing fields
 * - Schema.decode rejects invalid algorithm literals
 * - Schema.encode produces JSON-serializable output
 * - Round-trip: encode → decode preserves all fields
 * - SealAlgorithm schema validates literal union correctly
 * - SealedEnvelope integrates with Effect.gen via Schema.Class
 */
