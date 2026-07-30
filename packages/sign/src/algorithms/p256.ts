/**
 * Strict NIST P-256 ECDSA verification for SHA-256 and IEEE P1363 signatures.
 *
 * @since 0.1.1
 * @category algorithms
 */
import { p256 } from "@noble/curves/nist.js"
import { Effect } from "effect"
import { detachVerificationInputs } from "../internal/verificationInput.js"
import { InvalidVerificationInput, VerificationUnavailable } from "../schemas/errors.js"

/**
 * Verify a detached P-256 signature over `SHA-256(message)`.
 *
 * The public key must be the 65-byte uncompressed SEC1 encoding and the
 * signature must be the 64-byte IEEE P1363 `r || s` encoding with low `s`.
 * DER, compressed keys, out-of-range scalars, and high-S signatures are
 * rejected as `InvalidVerificationInput` before primitive execution.
 *
 * @since 0.1.1
 * @category algorithms
 */
export const p256Sha256P1363LowSVerify = (
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<boolean, InvalidVerificationInput | VerificationUnavailable> => {
  const detached = detachVerificationInputs(signature, message, publicKey)
  return detached.pipe(Effect.flatMap((input) =>
    Effect.gen(function*() {
      if (
        input.signature.length !== 64 ||
        input.publicKey.length !== 65 ||
        input.publicKey[0] !== 0x04
      ) {
        return yield* new InvalidVerificationInput({})
      }

      yield* Effect.try({
        try: () => p256.Point.fromBytes(input.publicKey),
        catch: () => new InvalidVerificationInput({})
      })
      const parsedSignature = yield* Effect.try({
        try: () => p256.Signature.fromBytes(input.signature, "compact"),
        catch: () => new InvalidVerificationInput({})
      })
      if (parsedSignature.hasHighS()) {
        return yield* new InvalidVerificationInput({})
      }

      return yield* Effect.try({
        try: () =>
          p256.verify(input.signature, input.message, input.publicKey, {
            format: "compact",
            lowS: true,
            prehash: true
          }),
        catch: () => new VerificationUnavailable({})
      })
    })
  ))
}
