/**
 * Unified sign/verify pipeline contract tests.
 *
 * Verifies:
 * - Algorithm dispatch routes to correct signature implementation
 * - sign("ed25519", ...) produces Ed25519 signatures
 * - sign("ml-dsa-65", ...) produces ML-DSA-65 signatures
 * - sign("secp256k1-ecdsa", ...) produces ECDSA signatures
 * - sign("secp256k1-schnorr", ...) produces Schnorr signatures
 * - Algorithm-tagged Signature output carries correct algorithm field
 * - Verify dispatches based on signature algorithm tag
 * - String input is UTF-8 encoded before signing
 * - Unknown algorithm produces descriptive error
 * - Roundtrip sign/verify for every supported signature algorithm
 * - X25519 and XWing are NOT accepted by sign() (wrong family)
 */
