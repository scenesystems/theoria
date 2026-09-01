/**
 * Schema-tagged failures emitted by encryption and decryption operations.
 *
 * @since 0.1.0
 * @category errors
 */
import { Schema } from "effect"
import { SealAlgorithm } from "./SealAlgorithm.js"

/**
 * Reports that envelope decoding or authenticated decryption failed.
 *
 * @remarks
 * `unseal` uses `invalid envelope encoding` for invalid base64url and `authentication failed`
 * for wrong keys, malformed lengths, and modified ciphertext. Preserve that coarse distinction
 * when exposing failures across a security boundary.
 *
 * @since 0.1.0
 * @category errors
 */
export class DecryptionFailed extends Schema.TaggedError<DecryptionFailed>()(
  "DecryptionFailed",
  {
    /** Algorithm selected for the failed operation. */
    algorithm: SealAlgorithm,
    /** Stable diagnostic reason supplied by the operation. */
    reason: Schema.String
  }
) {}

/**
 * Reports a key whose length is not 32 bytes or whose bytes are all zero.
 *
 * @since 0.1.0
 * @category errors
 */
export class InvalidKey extends Schema.TaggedError<InvalidKey>()(
  "InvalidKey",
  {
    /** Required key length in bytes; currently always 32. */
    expected: Schema.Number,
    /** Supplied key length in bytes. */
    received: Schema.Number,
    /** Diagnostic describing the failed key check; never includes key bytes. */
    reason: Schema.String
  }
) {}
