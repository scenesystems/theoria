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
import { detachVerificationInputs } from "../internal/verificationInput.js"
import { InvalidVerificationInput, SigningFailed, VerificationUnavailable } from "../schemas/errors.js"
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
 * Verify a detached pure-Ed25519 signature using the strict RFC 8032 profile.
 *
 * Both encoded points must be canonical and non-small-order, `S` must be less
 * than the subgroup order, and Noble's ZIP-215 mode is explicitly disabled.
 * Malformed input fails with `InvalidVerificationInput`; a canonical signature
 * that does not match returns `false`.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const ed25519Verify = (
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<boolean, InvalidVerificationInput | VerificationUnavailable> => {
  const detached = detachVerificationInputs(signature, message, publicKey)
  return detached.pipe(Effect.flatMap((input) =>
    Effect.gen(function*() {
      if (input.signature.length !== 64 || input.publicKey.length !== 32) {
        return yield* new InvalidVerificationInput({})
      }

      const verificationKeyPoint = yield* Effect.try({
        try: () => ed25519.Point.fromBytes(input.publicKey, false),
        catch: () => new InvalidVerificationInput({})
      })
      if (verificationKeyPoint.isSmallOrder()) {
        return yield* new InvalidVerificationInput({})
      }

      const signaturePoint = yield* Effect.try({
        try: () => ed25519.Point.fromBytes(input.signature.subarray(0, 32), false),
        catch: () => new InvalidVerificationInput({})
      })
      if (signaturePoint.isSmallOrder()) {
        return yield* new InvalidVerificationInput({})
      }

      yield* Effect.try({
        try: () => ed25519.Point.Fn.fromBytes(input.signature.subarray(32, 64)),
        catch: () => new InvalidVerificationInput({})
      })

      return yield* Effect.try({
        try: () => ed25519.verify(input.signature, input.message, input.publicKey, { zip215: false }),
        catch: () => new VerificationUnavailable({})
      })
    })
  ))
}

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
