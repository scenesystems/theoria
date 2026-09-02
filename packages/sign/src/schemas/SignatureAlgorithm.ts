/**
 * Defines the algorithm discriminators accepted by signature operations.
 *
 * @since 0.1.0
 * @category schemas
 */
import { Schema } from "effect"

/**
 * Restricts signature dispatch to the classical and post-quantum signing suites
 * implemented by this package. Agreement and KEM tags fail schema decoding.
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
