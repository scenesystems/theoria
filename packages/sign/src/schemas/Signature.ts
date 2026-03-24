/**
 * Algorithm-tagged signature as a Schema.Class.
 *
 * Self-describing signature carrying the algorithm tag and the
 * public key used for verification. The algorithm field determines
 * which verification function to dispatch to.
 *
 * @see {@link SignatureAlgorithm} — algorithm discriminant
 * @see {@link KeyPair} — what produced this signature
 * @see {@link sign} — signing operation producing this type
 *
 * @since 0.1.0
 * @category schemas
 */
import { Schema } from "effect"
import { SignatureAlgorithm } from "./SignatureAlgorithm.js"

/**
 * Self-describing digital signature.
 *
 * @since 0.1.0
 * @category schemas
 */
export class Signature extends Schema.Class<Signature>("Signature")({
  algorithm: SignatureAlgorithm,
  signature: Schema.Uint8ArrayFromSelf,
  publicKey: Schema.Uint8ArrayFromSelf
}) {}
