/**
 * RFC 7748 X25519 key agreement.
 *
 * @since 0.5.0
 * @module
 */
import { x25519 } from "@noble/curves/ed25519.js"
import { Cause, Effect, Schema } from "effect"
import * as Entropy from "./Entropy.js"
import * as KeyPair from "./KeyPair.js"

const Algorithm = KeyPair.Algorithm.pipe(Schema.pickLiteral("x25519"))

/**
 * Caller-owned raw output from X25519 agreement.
 * Construction and decoding validate carriers, not lengths or provenance;
 * encoded bytes remain Uint8Arrays. The class neither copies nor redacts bytes.
 * Use a protocol-specific KDF before using the output as a symmetric key.
 *
 * @since 0.5.0
 * @category schemas
 */
export class SharedSecret extends Schema.Class<SharedSecret>("@scenesystems/sign/X25519/SharedSecret")({
  algorithm: Algorithm,
  sharedSecret: Schema.Uint8ArrayFromSelf
}, {
  title: "X25519 shared secret",
  description: "Raw X25519 output before protocol-specific key derivation."
}) {}

/**
 * X25519 agreement rejected key material or could not execute.
 * The reason may include unredacted backend diagnostics.
 *
 * @since 0.5.0
 * @category errors
 */
export class AgreementFailed extends Schema.TaggedError<AgreementFailed>(
  "@scenesystems/sign/X25519/AgreementFailed"
)("AgreementFailed", {
  algorithm: Algorithm,
  reason: Schema.String
}, {
  title: "X25519 agreement failed",
  description: "X25519 rejected local or peer key material or could not execute."
}) {}

/**
 * Generates an X25519 key pair from explicit entropy.
 * Requires Entropy.Entropy and returns a caller-owned 32-byte secret scalar
 * and 32-byte Montgomery-u public key. Source failure is GenerationFailed.
 *
 * @since 0.5.0
 * @category keys
 */
export const generateKeyPair = (): Effect.Effect<KeyPair.KeyPair, KeyPair.GenerationFailed, Entropy.Entropy> =>
  Entropy.bytes(32).pipe(
    Effect.mapError(() =>
      new KeyPair.GenerationFailed({ algorithm: "x25519", reason: "Key generation entropy unavailable" })
    ),
    Effect.flatMap((seed) =>
      Effect.try({
        try: () => {
          const { secretKey, publicKey } = x25519.keygen(seed)
          return new KeyPair.KeyPair({ algorithm: "x25519", publicKey, secretKey })
        },
        catch: (cause) => new KeyPair.GenerationFailed({ algorithm: "x25519", reason: Cause.pretty(Cause.fail(cause)) })
      })
    )
  )

/**
 * Derives a raw X25519 shared secret.
 * Takes the local 32-byte secret key and peer's 32-byte public key and returns
 * 32 raw bytes. Rejects low-order peer keys that produce all-zero output.
 * Does not authenticate the peer, bind the transcript, or apply a KDF.
 *
 * @since 0.5.0
 * @category agreement
 */
export const deriveSharedSecret = (
  secretKey: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<SharedSecret, AgreementFailed> =>
  Effect.try({
    try: () =>
      new SharedSecret({
        algorithm: "x25519",
        sharedSecret: x25519.getSharedSecret(secretKey, publicKey)
      }),
    catch: (error) => new AgreementFailed({ algorithm: "x25519", reason: Cause.pretty(Cause.fail(error)) })
  })
