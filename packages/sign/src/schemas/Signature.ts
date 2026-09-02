/**
 * Defines a detached signature together with its suite and verification key.
 *
 * @since 0.1.0
 * @category schemas
 */
import { Schema } from "effect"
import { SignatureAlgorithm } from "./SignatureAlgorithm.js"

/**
 * Supplies all data needed by {@link verify} to select a verifier.
 *
 * @remarks
 * The schema checks the discriminator and byte carriers. It does not validate
 * suite-specific lengths or establish trust in the embedded public key.
 *
 * @since 0.1.0
 * @category schemas
 */
export class Signature extends Schema.Class<Signature>("Signature")({
  /** Selects the verifier used by `verify`. */
  algorithm: SignatureAlgorithm,
  /** Detached signature bytes in the selected algorithm's encoding. */
  signature: Schema.Uint8ArrayFromSelf,
  /** Caller-supplied verification key carried with the signature. */
  publicKey: Schema.Uint8ArrayFromSelf
}) {}
