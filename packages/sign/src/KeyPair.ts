/**
 * Caller-owned public and secret key pairs for signing, agreement, and KEMs.
 * Each suite owns generation; this module owns the common representation.
 *
 * @since 0.5.0
 * @module
 */
import { Schema } from "effect"
import * as Signature from "./Signature.js"

/**
 * Suites for which this package generates key pairs. RSA and P-256 are
 * verification-only and therefore absent.
 * @since 0.5.0
 * @category schemas
 */
export const Algorithm = Schema.Literal(...Signature.Algorithm.literals, "x25519", "xwing").annotations({
  identifier: "@scenesystems/sign/KeyPair/Algorithm"
})

/**
 * A supported key-generation suite.
 * @since 0.5.0
 * @category models
 */
export type Algorithm = typeof Algorithm.Type

/**
 * Associates a suite with its caller-owned key bytes. The schema checks the tag
 * and Uint8Array carriers; it does not prove the keys form a pair or check their
 * lengths. Encoded fields remain Uint8Arrays. Secret keys are not redacted,
 * copied, stored, or destroyed by this class; applications own their lifecycle.
 * Nested byte arrays retain their native equality semantics.
 * @since 0.5.0
 * @category models
 */
export class KeyPair extends Schema.Class<KeyPair>("@scenesystems/sign/KeyPair")({
  algorithm: Algorithm,
  publicKey: Schema.Uint8ArrayFromSelf,
  secretKey: Schema.Uint8ArrayFromSelf
}) {}

/**
 * The selected suite could not generate a key pair. Diagnostics from some
 * backends are not redacted and need application policy before disclosure.
 * @since 0.5.0
 * @category errors
 */
export class GenerationFailed extends Schema.TaggedError<GenerationFailed>(
  "@scenesystems/sign/KeyPair/GenerationFailed"
)("KeyGenerationFailed", { algorithm: Algorithm, reason: Schema.String }) {}
