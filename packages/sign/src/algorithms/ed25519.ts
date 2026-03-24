/**
 * Ed25519 EdDSA digital signatures.
 *
 * Wraps `@noble/curves/ed25519` — audited (Trail of Bits, Cure53),
 * zero-dependency. Ed25519 provides 128-bit security with 32-byte
 * keys and 64-byte signatures. RFC 8032 deterministic signing.
 *
 * @since 0.1.0
 * @category algorithms
 */
import { ed25519 } from "@noble/curves/ed25519.js"
import { Effect } from "effect"
import { SigningFailed, VerificationFailed } from "../schemas/errors.js"
import { KeyPair } from "../schemas/KeyPair.js"
import { Signature } from "../schemas/Signature.js"

/**
 * Sign a message with Ed25519.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const ed25519Sign = (
  message: Uint8Array,
  secretKey: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<Signature, SigningFailed> =>
  Effect.try({
    try: () =>
      new Signature({
        algorithm: "ed25519",
        signature: ed25519.sign(message, secretKey),
        publicKey
      }),
    catch: (error) => new SigningFailed({ algorithm: "ed25519", reason: String(error) })
  })

/**
 * Verify an Ed25519 signature against a message and public key.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const ed25519Verify = (
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<boolean, VerificationFailed> =>
  Effect.try({
    try: () => ed25519.verify(signature, message, publicKey),
    catch: (error) => new VerificationFailed({ algorithm: "ed25519", reason: String(error) })
  })

/**
 * Generate an Ed25519 key pair.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const ed25519Keygen = (): Effect.Effect<KeyPair> =>
  Effect.sync(() => {
    const { secretKey, publicKey } = ed25519.keygen()
    return new KeyPair({ algorithm: "ed25519", publicKey, secretKey })
  })
