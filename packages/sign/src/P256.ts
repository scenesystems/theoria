/**
 * Strict NIST P-256 ECDSA verification for SHA-256 and IEEE P1363 signatures.
 *
 * @since 0.5.0
 * @module
 */
import { p256 } from "@noble/curves/nist.js"
import { Array as Arr, Boolean as B, Effect, Number as N, Option } from "effect"
import { detachVerificationInputs } from "./internal/verificationInput.js"
import * as Verification from "./Verification.js"

/**
 * Verifies a low-S IEEE P1363 P-256 signature over SHA-256 of the message.
 * The public key must be 65-byte uncompressed SEC1; the signature must be
 * 64-byte r || s with in-range scalars and low S. DER and compressed keys fail
 * admission. Hashes the supplied message exactly once; do not prehash it.
 *
 * Admits and copies inputs on each execution, with an inclusive
 * Verification.maxMessageBytes bound. Canonical nonmatches return false;
 * malformed input is Verification.InvalidInput and backend failure is
 * Verification.Unavailable. Neither error retains material. The synchronous
 * primitive cannot be interrupted. Key authentication belongs to the caller.
 * @see https://csrc.nist.gov/pubs/fips/186-5/final
 *
 * @since 0.5.0
 * @category verification
 */
export const verify = (
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<boolean, Verification.InvalidInput | Verification.Unavailable> =>
  detachVerificationInputs(signature, message, publicKey).pipe(
    Effect.filterOrFail(
      (input) => B.and(N.Equivalence(input.signature.length, 64), N.Equivalence(input.publicKey.length, 65)),
      () => new Verification.InvalidInput({})
    ),
    Effect.filterOrFail(
      (input) => Option.containsWith(N.Equivalence)(Arr.head(Arr.fromIterable(input.publicKey)), 0x04),
      () => new Verification.InvalidInput({})
    ),
    Effect.flatMap((input) =>
      Effect.gen(function*() {
        yield* Effect.try({
          try: () => p256.Point.fromBytes(input.publicKey),
          catch: () => new Verification.InvalidInput({})
        })
        yield* Effect.try({
          try: () => p256.Signature.fromBytes(input.signature, "compact"),
          catch: () => new Verification.InvalidInput({})
        }).pipe(
          Effect.filterOrFail(
            (candidate) => B.not(candidate.hasHighS()),
            () => new Verification.InvalidInput({})
          )
        )
        return yield* Effect.try({
          try: () =>
            p256.verify(input.signature, input.message, input.publicKey, {
              format: "compact",
              lowS: true,
              prehash: true
            }),
          catch: () => new Verification.Unavailable({})
        })
      })
    )
  )
