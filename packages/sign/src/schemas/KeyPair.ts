/**
 * Algorithm-tagged key pair as a Schema.Class.
 *
 * Runtime-validated key pair carrying the algorithm discriminant.
 * The `algorithm` field determines which operations are valid —
 * an Ed25519 key pair cannot be used with ML-DSA signing.
 *
 * Secret keys are `Uint8Array` — serialization to/from base64url
 * or hex is handled by {@link keyEncoding} in the internal layer.
 *
 * @see {@link SignatureAlgorithm} — algorithm discriminant
 * @see {@link Signature} — what this key pair produces
 * @see {@link generateKeyPair} — produces instances of this type
 *
 * @since 0.1.0
 * @category schemas
 */
import { Schema } from "effect"
import { AgreementAlgorithm } from "./AgreementAlgorithm.js"
import { KemAlgorithm } from "./KemAlgorithm.js"
import { SignatureAlgorithm } from "./SignatureAlgorithm.js"

/**
 * Union of all supported cryptographic algorithm families.
 *
 * @since 0.1.0
 * @category schemas
 */
export const CryptoAlgorithm = Schema.Union(SignatureAlgorithm, AgreementAlgorithm, KemAlgorithm)

/**
 * Algorithm-tagged cryptographic key pair.
 *
 * @since 0.1.0
 * @category schemas
 */
export class KeyPair extends Schema.Class<KeyPair>("KeyPair")({
  algorithm: CryptoAlgorithm,
  publicKey: Schema.Uint8ArrayFromSelf,
  secretKey: Schema.Uint8ArrayFromSelf
}) {}
