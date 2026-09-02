/**
 * Adapts Noble post-quantum signature primitives to package carriers and
 * typed failures.
 *
 * @internal
 */
import { Effect } from "effect"
import { SigningFailed, VerificationFailed } from "../schemas/errors.js"
import type { CryptoAlgorithm } from "../schemas/KeyPair.js"
import { KeyPair } from "../schemas/KeyPair.js"
import { Signature } from "../schemas/Signature.js"
import type { SignatureAlgorithm } from "../schemas/SignatureAlgorithm.js"

type SignatureAlgorithmType = typeof SignatureAlgorithm.Type
type CryptoAlgorithmType = typeof CryptoAlgorithm.Type

/**
 * Creates signing, verification, and key-generation operations for one Noble
 * post-quantum primitive.
 *
 * @internal
 */
export const makePqOps = (
  algorithm: SignatureAlgorithmType & CryptoAlgorithmType,
  primitive: {
    readonly keygen: () => { readonly publicKey: Uint8Array; readonly secretKey: Uint8Array }
    readonly sign: (message: Uint8Array, secretKey: Uint8Array) => Uint8Array
    readonly verify: (signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array) => boolean
  }
) => ({
  sign: (message: Uint8Array, secretKey: Uint8Array, publicKey: Uint8Array) =>
    Effect.try({
      try: () =>
        new Signature({
          algorithm,
          signature: primitive.sign(message, secretKey),
          publicKey
        }),
      catch: (error) => new SigningFailed({ algorithm, reason: String(error) })
    }),
  verify: (signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array) =>
    Effect.try({
      try: () => primitive.verify(signature, message, publicKey),
      catch: (error) => new VerificationFailed({ algorithm, reason: String(error) })
    }),
  keygen: () =>
    Effect.sync(() => {
      const keys = primitive.keygen()
      return new KeyPair({ algorithm, publicKey: keys.publicKey, secretKey: keys.secretKey })
    })
})
