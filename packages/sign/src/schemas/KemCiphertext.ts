/**
 * KEM encapsulation output as a Schema.Class.
 *
 * Carries the encapsulated ciphertext and shared secret from
 * a KEM operation (XWing). The ciphertext is sent to the recipient,
 * who decapsulates it with their secret key to recover the same
 * shared secret.
 *
 * @see {@link KemAlgorithm} — algorithm discriminant
 * @see {@link kem} — the pipeline that produces this type
 *
 * @since 0.1.0
 * @category schemas
 */
import { Schema } from "effect"
import { KemAlgorithm } from "./KemAlgorithm.js"

/**
 * Algorithm-tagged KEM encapsulation result.
 *
 * @since 0.1.0
 * @category schemas
 */
export class KemCiphertext extends Schema.Class<KemCiphertext>("KemCiphertext")({
  algorithm: KemAlgorithm,
  ciphertext: Schema.Uint8ArrayFromSelf,
  sharedSecret: Schema.Uint8ArrayFromSelf
}) {}
