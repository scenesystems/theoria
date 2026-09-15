/**
 * Adapts Noble post-quantum signature primitives to package carriers and
 * typed failures.
 *
 * @internal
 */
import type { Signer } from "@noble/post-quantum/utils.js"
import { Cause, Data, Effect } from "effect"
import { KeyGenerationFailed, SigningFailed, VerificationFailed } from "../schemas/errors.js"
import { KeyPair } from "../schemas/KeyPair.js"
import { Signature } from "../schemas/Signature.js"
import type { SignatureAlgorithm } from "../schemas/SignatureAlgorithm.js"

/**
 * Creates signing, verification, and key-generation operations for one Noble
 * post-quantum primitive.
 *
 * @internal
 */
export const makePqOps = (
  algorithm: typeof SignatureAlgorithm.Type,
  primitive: Signer
) =>
  Data.struct({
    sign: (message: Uint8Array, secretKey: Uint8Array, publicKey: Uint8Array) =>
      Effect.try({
        try: () =>
          new Signature({
            algorithm,
            signature: primitive.sign(message, secretKey),
            publicKey
          }),
        catch: (error) => new SigningFailed({ algorithm, reason: Cause.pretty(Cause.fail(error)) })
      }),
    verify: (signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array) =>
      Effect.try({
        try: () => primitive.verify(signature, message, publicKey),
        catch: (error) => new VerificationFailed({ algorithm, reason: Cause.pretty(Cause.fail(error)) })
      }),
    keygen: () =>
      Effect.try({
        try: () => {
          const keys = primitive.keygen()
          return new KeyPair({ algorithm, publicKey: keys.publicKey, secretKey: keys.secretKey })
        },
        catch: (cause) => new KeyGenerationFailed({ algorithm, reason: Cause.pretty(Cause.fail(cause)) })
      })
  })
