/**
 * Unified digest pipeline contract tests.
 *
 * Verifies:
 * - Algorithm-tagged output format (`blake3-256:<base64url>`)
 * - Pipeline composition (canonicalize → encode → digest → tag)
 * - Algorithm selection
 */
