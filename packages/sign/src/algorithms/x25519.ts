/**
 * X25519 ECDH key agreement.
 *
 * Wraps `@noble/curves/ed25519` (X25519 is the Montgomery form
 * of Curve25519) — audited (Trail of Bits, Cure53). RFC 7748.
 * 32-byte keys, 32-byte shared secret.
 *
 * @since 0.1.0
 * @category algorithms
 */
import { x25519 } from "@noble/curves/ed25519.js"
import { Effect } from "effect"
import { KeyPair } from "../schemas/KeyPair.js"
import { SharedSecret } from "../schemas/SharedSecret.js"

/**
 * Derive a shared secret via X25519 ECDH.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const x25519SharedSecret = (
  secretKey: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<SharedSecret> =>
  Effect.sync(() =>
    new SharedSecret({
      algorithm: "x25519",
      sharedSecret: x25519.getSharedSecret(secretKey, publicKey)
    })
  )

/**
 * Generate an X25519 key pair.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const x25519Keygen = (): Effect.Effect<KeyPair> =>
  Effect.sync(() => {
    const { secretKey, publicKey } = x25519.keygen()
    return new KeyPair({ algorithm: "x25519", publicKey, secretKey })
  })
