/**
 * Schema-validated signature algorithm literal.
 *
 * Ten digital signature algorithms across two families:
 * - **Classical**: Ed25519, secp256k1 (ECDSA + Schnorr)
 * - **Post-quantum**: ML-DSA (3 security levels), SLH-DSA (4 parameter sets)
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
import { Schema } from "effect"

/**
 * Supported digital signature algorithms.
 *
 * @since 0.1.0
 * @category schemas
 */
export const SignatureAlgorithm = Schema.Literal(
  "ed25519",
  "secp256k1-ecdsa",
  "secp256k1-schnorr",
  "ml-dsa-44",
  "ml-dsa-65",
  "ml-dsa-87",
  "slh-dsa-sha2-128f",
  "slh-dsa-sha2-128s",
  "slh-dsa-sha2-192f",
  "slh-dsa-sha2-256f"
)
