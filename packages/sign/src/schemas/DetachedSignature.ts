/**
 * Algorithm-tagged detached signature carrier.
 *
 * Detached signatures carry only the algorithm tag and signature bytes. The
 * verifying public key stays outside the artifact so identity material can be
 * transported, stored, or rotated independently of the detached proof itself.
 *
 * @see {@link Signature} for the self-describing carrier that embeds the public key
 * @see {@link signDetached} for the detached signing operation
 * @see {@link verifyDetached} for explicit-key detached verification
 *
 * @since 0.2.0
 * @category schemas
 */
import { Schema } from "effect"
import { SignatureAlgorithm } from "./SignatureAlgorithm.js"

/**
 * Portable detached digital signature.
 *
 * @since 0.2.0
 * @category schemas
 */
export class DetachedSignature extends Schema.Class<DetachedSignature>("DetachedSignature")({
  algorithm: SignatureAlgorithm,
  signature: Schema.Uint8ArrayFromSelf
}) {}
