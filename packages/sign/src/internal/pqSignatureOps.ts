/**
 * Factory for post-quantum signature sign/verify/keygen operations.
 *
 * Eliminates copy-paste across ML-DSA and SLH-DSA algorithm modules
 * by extracting the shared Noble post-quantum primitive interface
 * into a single factory. Each algorithm module calls `makePqOps`
 * with its Noble primitive and algorithm literal.
 *
 * Noble post-quantum primitives (ml-dsa, slh-dsa) share the same
 * interface: `keygen() → { publicKey, secretKey }`,
 * `sign(message, secretKey) → signature`,
 * `verify(signature, message, publicKey) → boolean`.
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
 * Create sign/verify/keygen for a Noble post-quantum primitive.
 *
 * @internal
 */
export const makePqOps = (
  algorithm: SignatureAlgorithmType & CryptoAlgorithmType,
  primitive: {
    readonly keygen: () => { readonly publicKey: Uint8Array; readonly secretKey: Uint8Array }
    readonly sign: (
      message: Uint8Array,
      secretKey: Uint8Array,
      options?: { readonly extraEntropy?: false | Uint8Array }
    ) => Uint8Array
    readonly verify: (signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array) => boolean
  }
) => ({
  sign: (message: Uint8Array, secretKey: Uint8Array, publicKey: Uint8Array) =>
    Effect.try({
      try: () =>
        new Signature({
          algorithm,
          signature: primitive.sign(message, secretKey, { extraEntropy: false }),
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
