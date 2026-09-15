/**
 * Strict NIST P-256 ECDSA verification for SHA-256 and IEEE P1363 signatures.
 *
 * @since 0.1.1
 * @category algorithms
 * @module
 */
import { p256 } from "@noble/curves/nist.js"
import { Array as Arr, Boolean as B, Effect, Number as N, Option } from "effect"
import { detachVerificationInputs } from "../internal/verificationInput.js"
import { InvalidVerificationInput, VerificationUnavailable } from "../schemas/errors.js"

/**
 * Verifies a detached P-256 signature over `SHA-256(message)`.
 *
 * @remarks
 * The public key must be the 65-byte uncompressed SEC1 encoding and the
 * signature must be the 64-byte IEEE P1363 `r || s` encoding with low `s`.
 * DER, compressed keys, out-of-range scalars, and high-S signatures are
 * rejected as `InvalidVerificationInput` before primitive execution.
 *
 * Inputs are copied when the Effect executes. Messages longer than 8,192 bytes
 * are rejected. This operation hashes the supplied message once with SHA-256;
 * callers must not pass a digest unless hashing that digest is intended.
 *
 * @param signature - Exactly 64 IEEE P1363 `r || s` bytes.
 * @param message - Unhashed protected message bytes, at most 8,192 bytes.
 * @param publicKey - Exactly 65 uncompressed SEC1 point bytes.
 * @returns `true` for a match, `false` for an admitted nonmatch, or a
 * material-free typed admission or backend failure.
 * @see https://csrc.nist.gov/pubs/fips/186-5/final
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
  return detached.pipe(
    Effect.filterOrFail(
      (input) => B.and(N.Equivalence(input.signature.length, 64), N.Equivalence(input.publicKey.length, 65)),
      () => new InvalidVerificationInput({})
    ),
    Effect.filterOrFail(
      (input) => Option.containsWith(N.Equivalence)(Arr.head(Arr.fromIterable(input.publicKey)), 0x04),
      () => new InvalidVerificationInput({})
    ),
    Effect.flatMap((input) =>
      Effect.gen(function*() {
        yield* Effect.try({
          try: () => p256.Point.fromBytes(input.publicKey),
          catch: () => new InvalidVerificationInput({})
        })
        yield* Effect.try({
          try: () => p256.Signature.fromBytes(input.signature, "compact"),
          catch: () => new InvalidVerificationInput({})
        }).pipe(Effect.filterOrFail(
          (signature) => B.not(signature.hasHighS()),
          () => new InvalidVerificationInput({})
        ))

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
    )
  )
}
