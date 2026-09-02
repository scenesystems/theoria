/**
 * Implements RFC 7748 X25519 agreement with 32-byte keys and 32-byte raw
 * shared secrets.
 *
 * @since 0.1.0
 * @category algorithms
 */
import { x25519 } from "@noble/curves/ed25519.js"
import { Effect } from "effect"
import { AgreementFailed } from "../schemas/errors.js"
import { KeyPair } from "../schemas/KeyPair.js"
import { SharedSecret } from "../schemas/SharedSecret.js"

/**
 * Derives a raw shared secret via X25519 ECDH.
 *
 * @param secretKey - The local party's 32-byte secret key.
 * @param publicKey - The peer's 32-byte public key; this function does not authenticate it.
 * @returns The tagged raw 32-byte X25519 output, or
 * `AgreementFailed`. Apply protocol-appropriate KDF and transcript binding.
 * @see https://www.rfc-editor.org/rfc/rfc7748
 *
 * @since 0.1.0
 * @category algorithms
 */
export const x25519SharedSecret = (
  secretKey: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<SharedSecret, AgreementFailed> =>
  Effect.try({
    try: () =>
      new SharedSecret({
        algorithm: "x25519",
        sharedSecret: x25519.getSharedSecret(secretKey, publicKey)
      }),
    catch: (error) => new AgreementFailed({ algorithm: "x25519", reason: String(error) })
  })

/**
 * Draws an X25519 key pair from Noble's ambient CSPRNG, returning a 32-byte
 * secret scalar and 32-byte Montgomery-u public key.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const x25519Keygen = (): Effect.Effect<KeyPair> =>
  Effect.sync(() => {
    const { secretKey, publicKey } = x25519.keygen()
    return new KeyPair({ algorithm: "x25519", publicKey, secretKey })
  })
