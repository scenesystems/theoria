/**
 * Unified sign/verify pipeline.
 *
 * Dispatches to the appropriate algorithm implementation based on
 * a {@link SignatureAlgorithm} discriminant, providing a single
 * API surface for all digital signature operations.
 *
 * Verification follows the inverse path — the algorithm tag on the
 * signature determines which verifier to use, ensuring signatures
 * are always verified with the correct algorithm.
 *
 * @see {@link SignatureAlgorithm} — supported algorithm literals (source of truth)
 * @see {@link agreement} — key agreement pipeline
 * @see {@link kem} — key encapsulation pipeline
 * @see {@link generateKeyPair} — key generation for all algorithms
 *
 * @since 0.1.0
 * @category signing
 */
