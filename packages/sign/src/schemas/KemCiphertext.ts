/**
 * Defines the sender-side result of key encapsulation.
 *
 * @since 0.1.0
 * @category schemas
 * @module
 */
import { Schema } from "effect"
import { KemAlgorithm } from "./KemAlgorithm.js"

/**
 * Carries the ciphertext for the recipient and the sender's copy of the raw
 * shared secret.
 *
 * @remarks
 * The schema checks only the discriminator and `Uint8Array` carriers. It does
 * not validate X-Wing byte lengths or cryptographic provenance.
 *
 * @since 0.1.0
 * @category schemas
 */
export class KemCiphertext extends Schema.Class<KemCiphertext>("KemCiphertext")({
  /** KEM suite that produced this result. */
  algorithm: KemAlgorithm,
  /** Encapsulation bytes to transmit to the recipient. */
  ciphertext: Schema.Uint8ArrayFromSelf,
  /** Sender's caller-owned raw shared secret; do not transmit it. */
  sharedSecret: Schema.Uint8ArrayFromSelf
}) {}
