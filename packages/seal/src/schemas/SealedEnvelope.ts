/**
 * Schema-validated sealed envelope.
 *
 * `Schema.Class` representing an authenticated encryption output.
 * Contains the algorithm identifier, base64url-encoded nonce, and
 * base64url-encoded ciphertext (which includes the authentication
 * tag as appended by `@noble/ciphers`).
 *
 * The envelope is self-describing — the `algorithm` field determines
 * the nonce length and cipher used for decryption. This enables
 * algorithm-agnostic storage and key rotation workflows.
 *
 * Serializable via `Schema.encode` for JSON persistence (encrypted
 * study snapshots, encrypted cache entries, encrypted DSP modules).
 *
 * @see {@link SealAlgorithm} — the algorithm field schema
 * @see {@link seal} — produces envelopes
 * @see {@link unseal} — consumes envelopes
 *
 * @since 0.1.0
 * @category schemas
 */
import { Schema } from "effect"
import { SealAlgorithm } from "./SealAlgorithm.js"

/**
 * Self-describing authenticated encryption envelope.
 *
 * @since 0.1.0
 * @category schemas
 */
export class SealedEnvelope extends Schema.Class<SealedEnvelope>("SealedEnvelope")({
  algorithm: SealAlgorithm,
  nonce: Schema.String,
  ciphertext: Schema.String
}) {}
