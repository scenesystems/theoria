/**
 * secp256k1 ECDSA and Schnorr (BIP-340) signatures.
 *
 * Wraps `@noble/curves/secp256k1` — audited (Trail of Bits, Cure53),
 * zero-dependency. ECDSA uses RFC 6979 deterministic k-generation.
 * Schnorr (BIP-340) produces 64-byte signatures with 32-byte
 * x-only public keys.
 *
 * @since 0.1.0
 * @category algorithms
 */
import { schnorr, secp256k1 } from "@noble/curves/secp256k1.js"
import { Effect } from "effect"
import { SigningFailed, VerificationFailed } from "../schemas/errors.js"
import { KeyPair } from "../schemas/KeyPair.js"
import { Signature } from "../schemas/Signature.js"

/**
 * Sign a message with secp256k1 ECDSA (RFC 6979 deterministic k).
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
 * Verify a secp256k1 ECDSA signature.
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
 * Generate a secp256k1 ECDSA key pair.
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
 * Sign a message with secp256k1 Schnorr (BIP-340).
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
 * Verify a secp256k1 Schnorr (BIP-340) signature.
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
 * Generate a secp256k1 Schnorr key pair.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const secp256k1SchnorrKeygen = (): Effect.Effect<KeyPair> =>
  Effect.sync(() => {
    const { secretKey, publicKey } = schnorr.keygen()
    return new KeyPair({ algorithm: "secp256k1-schnorr", publicKey, secretKey })
  })
