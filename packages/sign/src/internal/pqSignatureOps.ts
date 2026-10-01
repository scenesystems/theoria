/**
 * Adapts Noble post-quantum signature primitives to package carriers and
 * typed failures.
 *
 * @internal
 */
import type { Signer } from "@noble/post-quantum/utils.js"
import { Cause, Data, Effect, Schema } from "effect"
import * as Entropy from "../Entropy.js"
import * as KeyPair from "../KeyPair.js"
import * as Signature from "../Signature.js"
import { copyBytes } from "./verificationInput.js"

/**
 * Creates signing, verification, and key-generation operations for one Noble
 * post-quantum primitive.
 *
 * @internal
 */
export const makePqOps = (
  algorithm: Signature.Algorithm,
  primitive: Signer,
  seedBytes: number,
  signingEntropyBytes: number
) =>
  Data.struct({
    sign: (message: Uint8Array, secretKey: Uint8Array, publicKey: Uint8Array) =>
      Effect.all({
        message: copyBytes(message, Schema.NonNegativeInt),
        secretKey: copyBytes(secretKey, Schema.NonNegativeInt),
        publicKey: copyBytes(publicKey, Schema.NonNegativeInt)
      }).pipe(
        Effect.mapError(() => new Signature.SigningFailed({ algorithm, reason: "invalid input" })),
        Effect.flatMap((input) =>
          Entropy.bytes(signingEntropyBytes).pipe(
            Effect.mapError(() => new Signature.SigningFailed({ algorithm, reason: "Signing entropy unavailable" })),
            Effect.flatMap((entropy) =>
              Effect.try({
                try: () =>
                  new Signature.Signature({
                    algorithm,
                    signature: primitive.sign(input.message, input.secretKey, { extraEntropy: entropy }),
                    publicKey: input.publicKey
                  }),
                catch: (error) => new Signature.SigningFailed({ algorithm, reason: Cause.pretty(Cause.fail(error)) })
              })
            )
          )
        )
      ),
    verify: (signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array) =>
      Effect.try({
        try: () => primitive.verify(signature, message, publicKey),
        catch: (error) => new Signature.VerificationFailed({ algorithm, reason: Cause.pretty(Cause.fail(error)) })
      }),
    keygen: () =>
      Entropy.bytes(seedBytes).pipe(
        Effect.mapError(() =>
          new KeyPair.GenerationFailed({ algorithm, reason: "Key generation entropy unavailable" })
        ),
        Effect.flatMap((seed) =>
          Effect.try({
            try: () => {
              const keys = primitive.keygen(seed)
              return new KeyPair.KeyPair({ algorithm, publicKey: keys.publicKey, secretKey: keys.secretKey })
            },
            catch: (cause) => new KeyPair.GenerationFailed({ algorithm, reason: Cause.pretty(Cause.fail(cause)) })
          })
        )
      )
  })

/** Creates an entropy-free signing operation for a primitive profile. */
export const makeDeterministicPqSign = (
  algorithm: Signature.Algorithm,
  primitive: Signer
) =>
(message: Uint8Array, secretKey: Uint8Array, publicKey: Uint8Array) =>
  Effect.try({
    try: () =>
      new Signature.Signature({
        algorithm,
        signature: primitive.sign(message, secretKey, { extraEntropy: false }),
        publicKey
      }),
    catch: (error) => new Signature.SigningFailed({ algorithm, reason: Cause.pretty(Cause.fail(error)) })
  })
