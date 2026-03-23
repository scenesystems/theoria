/**
 * Supported digital signature algorithms as a Schema literal union.
 *
 * ```ts
 * const SignatureAlgorithm = Schema.Literal(
 *   "ed25519",
 *   "secp256k1-ecdsa",
 *   "secp256k1-schnorr",
 *   "ml-dsa-44",
 *   "ml-dsa-65",
 *   "ml-dsa-87",
 *   "slh-dsa-sha2-128f",
 *   "slh-dsa-sha2-128s",
 *   "slh-dsa-sha2-192f",
 *   "slh-dsa-sha2-256f"
 * )
 * ```
 *
 * Key agreement and KEM algorithms are NOT included — they are
 * separate cryptographic families with different operations.
 *
 * @see {@link KeyPair} — key pair tagged by this algorithm
 * @see {@link Signature} — signature tagged by this algorithm
 * @see {@link AgreementAlgorithm} — key agreement algorithms (separate family)
 * @see {@link KemAlgorithm} — key encapsulation algorithms (separate family)
 *
 * @since 0.1.0
 * @category schemas
 */
