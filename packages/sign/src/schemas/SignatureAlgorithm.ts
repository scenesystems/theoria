/**
 * Defines the algorithm discriminators accepted by signature operations.
 *
 * @since 0.1.0
 * @category schemas
 * @module
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

/**
 * Restricts `sign` to the suites whose signing profile is complete with a key
 * pair alone. ML-DSA-65 is absent: its signing requires caller-supplied
 * hedging entropy and a FIPS 204 context, which `mlDsa65SignHedged` accepts
 * explicitly. Every `SignatureAlgorithm` remains verifiable through `verify`.
 *
 * @since 0.3.0
 * @category schemas
 */
export const KeyOnlySigningAlgorithm = SignatureAlgorithm.pipe(
  Schema.pickLiteral(
    "ed25519",
    "secp256k1-ecdsa",
    "secp256k1-schnorr",
    "ml-dsa-44",
    "ml-dsa-87",
    "slh-dsa-sha2-128f",
    "slh-dsa-sha2-128s",
    "slh-dsa-sha2-192f",
    "slh-dsa-sha2-256f"
  )
)
