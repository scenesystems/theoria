/**
 * Key agreement output as a Schema.Class.
 *
 * Carries the 32-byte shared secret derived from X25519 key
 * agreement, tagged with the algorithm that produced it.
 *
 * @see {@link AgreementAlgorithm} — algorithm discriminant
 * @see {@link agreement} — the pipeline that produces this type
 *
 * @since 0.1.0
 * @category schemas
 */
import { Schema } from "effect"
import { AgreementAlgorithm } from "./AgreementAlgorithm.js"

/**
 * Algorithm-tagged shared secret from key agreement.
 *
 * @since 0.1.0
 * @category schemas
 */
export class SharedSecret extends Schema.Class<SharedSecret>("SharedSecret")({
  algorithm: AgreementAlgorithm,
  sharedSecret: Schema.Uint8ArrayFromSelf
}) {}
