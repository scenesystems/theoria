/**
 * X-Wing hybrid X25519 and ML-KEM-768 encapsulation.
 * Implements draft-connolly-cfrg-xwing-kem-06, not a finalized RFC.
 *
 * @since 0.5.0
 * @module
 */
import { ml_kem768_x25519 } from "@noble/post-quantum/hybrid.js"
import { Cause, Effect, Schema } from "effect"
import * as Entropy from "./Entropy.js"
import { copyBytes } from "./internal/verificationInput.js"
import * as KeyPair from "./KeyPair.js"

const Algorithm = KeyPair.Algorithm.pipe(Schema.pickLiteral("xwing"))

/**
 * Sender-side X-Wing ciphertext and raw shared secret.
 * Transmit only ciphertext; the shared secret must remain local. Encoded bytes
 * remain Uint8Arrays. Construction checks carriers, not lengths or provenance,
 * and does not copy or redact the nested bytes.
 *
 * @since 0.5.0
 * @category schemas
 */
export class Encapsulation extends Schema.Class<Encapsulation>("@scenesystems/sign/XWing/Encapsulation")({
  algorithm: Algorithm,
  ciphertext: Schema.Uint8ArrayFromSelf,
  sharedSecret: Schema.Uint8ArrayFromSelf
}, {
  title: "X-Wing encapsulation",
  description: "The ciphertext for a recipient and the sender's raw shared secret."
}) {}

/**
 * X-Wing rejected input or could not complete an operation.
 * The reason may include unredacted backend diagnostics.
 *
 * @since 0.5.0
 * @category errors
 */
export class Failed extends Schema.TaggedError<Failed>("@scenesystems/sign/XWing/Failed")("KemFailed", {
  algorithm: Algorithm,
  reason: Schema.String
}, {
  title: "X-Wing operation failed",
  description: "X-Wing rejected key or ciphertext input or could not execute."
}) {}

/**
 * Generates an X-Wing key pair from explicit entropy.
 * Requires Entropy.Entropy. Returns a caller-owned 32-byte secret seed and
 * 1,216-byte public key; entropy or backend failure is GenerationFailed.
 *
 * @since 0.5.0
 * @category keys
 */
export const generateKeyPair = (): Effect.Effect<KeyPair.KeyPair, KeyPair.GenerationFailed, Entropy.Entropy> =>
  Entropy.bytes(32).pipe(
    Effect.mapError(() =>
      new KeyPair.GenerationFailed({ algorithm: "xwing", reason: "Key generation entropy unavailable" })
    ),
    Effect.flatMap((seed) =>
      Effect.try({
        try: () => {
          const { secretKey, publicKey } = ml_kem768_x25519.keygen(seed)
          return new KeyPair.KeyPair({ algorithm: "xwing", publicKey, secretKey })
        },
        catch: (cause) => new KeyPair.GenerationFailed({ algorithm: "xwing", reason: Cause.pretty(Cause.fail(cause)) })
      })
    )
  )

/**
 * Encapsulates for an X-Wing public key using explicit entropy.
 * Requires Entropy.Entropy for 64 random bytes and a 1,216-byte recipient key.
 * Returns a 1,120-byte ciphertext and 32-byte raw shared secret. Authenticate
 * the recipient key separately and apply a protocol-bound KDF to the secret. The
 * recipient key is copied on each execution before requesting entropy. Unreadable
 * input fails as Failed before entropy acquisition; readable malformed keys remain
 * backend-validated after it.
 *
 * @since 0.5.0
 * @category encapsulation
 */
export const encapsulate = (
  publicKey: Uint8Array
): Effect.Effect<Encapsulation, Failed, Entropy.Entropy> =>
  copyBytes(publicKey, Schema.NonNegativeInt).pipe(
    Effect.mapError(() => new Failed({ algorithm: "xwing", reason: "invalid input" })),
    Effect.flatMap((publicKey) =>
      Entropy.bytes(64).pipe(
        Effect.mapError(() => new Failed({ algorithm: "xwing", reason: "Encapsulation entropy unavailable" })),
        Effect.flatMap((randomness) =>
          Effect.try({
            try: () => {
              const result = ml_kem768_x25519.encapsulate(publicKey, randomness)
              return new Encapsulation({
                algorithm: "xwing",
                ciphertext: result.cipherText,
                sharedSecret: result.sharedSecret
              })
            },
            catch: (error) => new Failed({ algorithm: "xwing", reason: Cause.pretty(Cause.fail(error)) })
          })
        )
      )
    )
  )

/**
 * Decapsulates an X-Wing ciphertext.
 * Takes a 1,120-byte ciphertext and 32-byte secret seed, returning 32 raw bytes.
 * Requires no entropy. A KEM does not authenticate its sender; a modified but
 * well-sized ciphertext need not fail and may derive a different secret.
 *
 * @since 0.5.0
 * @category encapsulation
 */
export const decapsulate = (
  ciphertext: Uint8Array,
  secretKey: Uint8Array
): Effect.Effect<Uint8Array, Failed> =>
  Effect.try({
    try: () => ml_kem768_x25519.decapsulate(ciphertext, secretKey),
    catch: (error) => new Failed({ algorithm: "xwing", reason: Cause.pretty(Cause.fail(error)) })
  })
