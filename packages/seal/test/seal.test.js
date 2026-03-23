/**
 * Unified seal/unseal pipeline tests.
 *
 * Verifies:
 * - seal → unseal round-trip for each algorithm
 * - Algorithm selection dispatches to correct cipher
 * - SealedEnvelope contains correct algorithm identifier
 * - Cross-algorithm: envelope from one algorithm rejected by another
 * - Key validation occurs before cipher invocation
 * - Invalid algorithm string is rejected
 * - Envelope self-description: unseal reads algorithm from envelope
 */
