/**
 * Implements deterministic pure-Ed25519 signing and strict RFC 8032
 * verification with 32-byte keys and 64-byte signatures.
 *
 * @since 0.1.0
 * @category algorithms
 * @module
 */
import { ed25519 } from "@noble/curves/ed25519.js"
import { Effect } from "effect"
import { detachVerificationInputs } from "../internal/verificationInput.js"
import { InvalidVerificationInput, SigningFailed, VerificationUnavailable } from "../schemas/errors.js"
import { KeyPair } from "../schemas/KeyPair.js"
import { Signature } from "../schemas/Signature.js"

/**
 * Produces a deterministic 64-byte pure-Ed25519 signature over the exact message
 * bytes. The 32-byte secret key is consumed by RFC 8032 signing; `publicKey` is
 * only copied into the returned `Signature` and is not checked against it.
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
 * Verifies a detached pure-Ed25519 signature using the strict RFC 8032 profile.
 *
 * @remarks
 * Both encoded points must be canonical and non-small-order, `S` must be less
 * than the subgroup order, and Noble's ZIP-215 mode is explicitly disabled.
 * Malformed input fails with `InvalidVerificationInput`; a canonical signature
 * that does not match returns `false`.
 *
 * Inputs are copied when the Effect executes and messages longer than 8,192
 * bytes are rejected. `VerificationUnavailable` means admitted input reached a
 * backend that could not execute; both failure types retain no input material.
 *
 * @param signature - Exactly 64 detached Ed25519 signature bytes.
 * @param message - Protected message bytes, at most 8,192 bytes.
 * @param publicKey - Exactly 32 canonical Ed25519 public-key bytes.
 * @returns `true` for a match, `false` for an admitted nonmatch, or a redacted
 * typed failure for invalid input or backend unavailability.
 * @see https://www.rfc-editor.org/rfc/rfc8032
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
 * Draws an Ed25519 key pair from Noble's ambient CSPRNG, returning a 32-byte
 * secret seed and its 32-byte compressed Edwards public key.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const ed25519Keygen = (): Effect.Effect<KeyPair> =>
  Effect.sync(() => {
    const { secretKey, publicKey } = ed25519.keygen()
    return new KeyPair({ algorithm: "ed25519", publicKey, secretKey })
  })
