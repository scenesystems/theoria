/**
 * Implements secp256k1 ECDSA over SHA-256 and BIP-340 Schnorr signatures.
 *
 * @remarks
 * ECDSA uses compact 64-byte signatures, RFC 6979 nonce generation, and
 * low-S normalization. Schnorr uses 64-byte signatures, 32-byte messages, and
 * 32-byte x-only public keys.
 *
 * @since 0.1.0
 * @category algorithms
 * @module
 */
import { schnorr, secp256k1 } from "@noble/curves/secp256k1.js"
import { Effect } from "effect"
import { SigningFailed, VerificationFailed } from "../schemas/errors.js"
import { KeyPair } from "../schemas/KeyPair.js"
import { Signature } from "../schemas/Signature.js"

/**
 * Produces a 64-byte compact secp256k1 ECDSA signature over
 * `SHA-256(message)` with deterministic RFC 6979 nonce generation and low `s`.
 * `publicKey` is copied into the result rather than validated against the
 * 32-byte secret scalar.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const secp256k1EcdsaSign = (
  message: Uint8Array,
  secretKey: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<Signature, SigningFailed> =>
  Effect.try({
    try: () =>
      new Signature({
        algorithm: "secp256k1-ecdsa",
        signature: secp256k1.sign(message, secretKey),
        publicKey
      }),
    catch: (error) => new SigningFailed({ algorithm: "secp256k1-ecdsa", reason: String(error) })
  })

/**
 * Checks a compact secp256k1 ECDSA signature over `SHA-256(message)`.
 * A validly encoded nonmatch returns `false`; rejected encodings or primitive
 * exceptions fail with `VerificationFailed` and a backend-derived reason.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const secp256k1EcdsaVerify = (
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<boolean, VerificationFailed> =>
  Effect.try({
    try: () => secp256k1.verify(signature, message, publicKey),
    catch: (error) => new VerificationFailed({ algorithm: "secp256k1-ecdsa", reason: String(error) })
  })

/**
 * Draws a secp256k1 ECDSA key pair from Noble's ambient CSPRNG, returning a
 * 32-byte secret scalar and 33-byte compressed SEC1 public key.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const secp256k1EcdsaKeygen = (): Effect.Effect<KeyPair> =>
  Effect.sync(() => {
    const { secretKey, publicKey } = secp256k1.keygen()
    return new KeyPair({ algorithm: "secp256k1-ecdsa", publicKey, secretKey })
  })

/**
 * Produces a 64-byte BIP-340 Schnorr signature over the supplied 32-byte
 * message. Noble obtains fresh auxiliary randomness from its ambient CSPRNG;
 * `publicKey` is only copied into the returned carrier.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const secp256k1SchnorrSign = (
  message: Uint8Array,
  secretKey: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<Signature, SigningFailed> =>
  Effect.try({
    try: () =>
      new Signature({
        algorithm: "secp256k1-schnorr",
        signature: schnorr.sign(message, secretKey),
        publicKey
      }),
    catch: (error) => new SigningFailed({ algorithm: "secp256k1-schnorr", reason: String(error) })
  })

/**
 * Checks a 64-byte BIP-340 Schnorr signature for a 32-byte message and 32-byte
 * x-only public key. An admitted nonmatch returns `false`; malformed input or
 * backend exceptions fail with `VerificationFailed`.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const secp256k1SchnorrVerify = (
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<boolean, VerificationFailed> =>
  Effect.try({
    try: () => schnorr.verify(signature, message, publicKey),
    catch: (error) => new VerificationFailed({ algorithm: "secp256k1-schnorr", reason: String(error) })
  })

/**
 * Draws a BIP-340 key pair from Noble's ambient CSPRNG, returning a 32-byte
 * secret scalar and 32-byte x-only public key.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const secp256k1SchnorrKeygen = (): Effect.Effect<KeyPair> =>
  Effect.sync(() => {
    const { secretKey, publicKey } = schnorr.keygen()
    return new KeyPair({ algorithm: "secp256k1-schnorr", publicKey, secretKey })
  })
