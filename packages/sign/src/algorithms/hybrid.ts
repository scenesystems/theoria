/**
 * Implements the X-Wing KEM that combines X25519 with ML-KEM-768.
 *
 * @remarks
 * Encapsulation returns a 1,120-byte ciphertext and a 32-byte raw shared
 * secret. X-Wing keys use a 1,216-byte public key and 32-byte secret seed.
 * These operations obtain key-generation and encapsulation randomness from
 * Noble's ambient CSPRNG and do not authenticate either party.
 *
 * @since 0.1.0
 * @category algorithms
 * @module
 */
import { ml_kem768_x25519 } from "@noble/post-quantum/hybrid.js"
import { Effect } from "effect"
import { KemFailed } from "../schemas/errors.js"
import { KemCiphertext } from "../schemas/KemCiphertext.js"
import { KeyPair } from "../schemas/KeyPair.js"

/**
 * Encapsulates for a 1,216-byte X-Wing recipient public key, drawing
 * ephemeral X25519 and ML-KEM-768 randomness from Noble's ambient CSPRNG. The
 * result contains a 1,120-byte ciphertext and 32-byte sender shared secret;
 * only the ciphertext is sent to the recipient.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const xwingEncapsulate = (
  publicKey: Uint8Array
): Effect.Effect<KemCiphertext, KemFailed> =>
  Effect.try({
    try: () => {
      const result = ml_kem768_x25519.encapsulate(publicKey)
      return new KemCiphertext({
        algorithm: "xwing",
        ciphertext: result.cipherText,
        sharedSecret: result.sharedSecret
      })
    },
    catch: (error) => new KemFailed({ algorithm: "xwing", reason: String(error) })
  })

/**
 * Recovers the 32-byte X-Wing shared secret from a 1,120-byte ciphertext and
 * the recipient's 32-byte secret seed. Rejected lengths or backend failures
 * are reported as `KemFailed`; the operation does not authenticate the sender.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const xwingDecapsulate = (
  cipherText: Uint8Array,
  secretKey: Uint8Array
): Effect.Effect<Uint8Array, KemFailed> =>
  Effect.try({
    try: () => ml_kem768_x25519.decapsulate(cipherText, secretKey),
    catch: (error) => new KemFailed({ algorithm: "xwing", reason: String(error) })
  })

/**
 * Draws an X-Wing key pair from Noble's ambient CSPRNG, returning a 1,216-byte
 * serialized X25519 + ML-KEM-768 public key and a 32-byte secret seed.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const xwingKeygen = (): Effect.Effect<KeyPair> =>
  Effect.sync(() => {
    const { secretKey, publicKey } = ml_kem768_x25519.keygen()
    return new KeyPair({ algorithm: "xwing", publicKey, secretKey })
  })
