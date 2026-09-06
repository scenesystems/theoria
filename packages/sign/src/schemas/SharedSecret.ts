/**
 * Defines algorithm-tagged output from raw key agreement.
 *
 * @since 0.1.0
 * @category schemas
 * @module
 */
import { Schema } from "effect"
import { AgreementAlgorithm } from "./AgreementAlgorithm.js"

/**
 * Carries caller-owned X25519 output before protocol-specific key derivation.
 *
 * @remarks
 * The schema accepts any `Uint8Array`; it does not enforce the 32-byte X25519
 * output length or establish peer authentication.
 *
 * @since 0.1.0
 * @category schemas
 */
export class SharedSecret extends Schema.Class<SharedSecret>("SharedSecret")({
  /** Agreement suite that produced the secret. */
  algorithm: AgreementAlgorithm,
  /** Caller-owned raw X25519 output; no KDF has been applied. */
  sharedSecret: Schema.Uint8ArrayFromSelf
}) {}
