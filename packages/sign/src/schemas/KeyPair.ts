/**
 * Defines algorithm-tagged public and secret key bytes.
 *
 * @since 0.1.0
 * @category schemas
 */
import { Schema } from "effect"
import { AgreementAlgorithm } from "./AgreementAlgorithm.js"
import { KemAlgorithm } from "./KemAlgorithm.js"
import { SignatureAlgorithm } from "./SignatureAlgorithm.js"

/**
 * Admits every signature, agreement, and KEM discriminator implemented by the
 * package.
 *
 * @since 0.1.0
 * @category schemas
 */
export const CryptoAlgorithm = Schema.Union(SignatureAlgorithm, AgreementAlgorithm, KemAlgorithm)

/**
 * Associates caller-owned key bytes with the suite that interprets them.
 *
 * @remarks
 * The schema does not validate key lengths, derive the public key, or prove
 * that the two keys form a pair.
 *
 * @since 0.1.0
 * @category schemas
 */
export class KeyPair extends Schema.Class<KeyPair>("KeyPair")({
  /** Selects the primitive and valid operations for these bytes. */
  algorithm: CryptoAlgorithm,
  /** Public verification, agreement, or encapsulation key. */
  publicKey: Schema.Uint8ArrayFromSelf,
  /** Caller-owned secret key; the class does not redact or destroy it. */
  secretKey: Schema.Uint8ArrayFromSelf
}) {}
