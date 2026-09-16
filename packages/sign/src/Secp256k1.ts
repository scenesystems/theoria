/**
 * secp256k1 ECDSA and BIP-340 Schnorr operations.
 *
 * @since 0.5.0
 * @module
 */
import { schnorr, secp256k1 } from "@noble/curves/secp256k1.js"
import { Cause, Effect } from "effect"
import * as Entropy from "./Entropy.js"
import * as KeyPair from "./KeyPair.js"
import * as Signature from "./Signature.js"

/**
 * Signs with compact, low-S secp256k1 ECDSA over SHA-256.
 * Produces 64 bytes using deterministic RFC 6979; requires no Entropy service.
 * Hashes the supplied message once. The 32-byte secret scalar signs; the supplied
 * public key is stored in the result without copying or pair validation.
 *
 * @since 0.5.0
 * @category signing
 */
export const signEcdsa = (
  message: Uint8Array,
  secretKey: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<Signature.Signature, Signature.SigningFailed> =>
  Effect.try({
    try: () =>
      new Signature.Signature({
        algorithm: "secp256k1-ecdsa",
        signature: secp256k1.sign(message, secretKey),
        publicKey
      }),
    catch: (error) =>
      new Signature.SigningFailed({ algorithm: "secp256k1-ecdsa", reason: Cause.pretty(Cause.fail(error)) })
  })

/**
 * Verifies compact secp256k1 ECDSA over SHA-256.
 * Checks a 64-byte r || s signature with low S and hashes the message once.
 * Noble admits compressed or uncompressed SEC1 keys. Nonmatches return false;
 * backend exceptions become Signature.VerificationFailed with diagnostic text.
 * Authenticate the key separately. This is not the bounded strict P256 profile.
 *
 * @since 0.5.0
 * @category verification
 */
export const verifyEcdsa = (
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<boolean, Signature.VerificationFailed> =>
  Effect.try({
    try: () => secp256k1.verify(signature, message, publicKey),
    catch: (error) =>
      new Signature.VerificationFailed({ algorithm: "secp256k1-ecdsa", reason: Cause.pretty(Cause.fail(error)) })
  })

/**
 * Generates a secp256k1 ECDSA key pair from 48 bytes of explicit entropy.
 * Requires Entropy.Entropy; Noble maps the seed to a valid 32-byte scalar with
 * negligible bias. Returns that scalar and a 33-byte compressed SEC1 public key.
 * Source and backend failures become KeyPair.GenerationFailed.
 *
 * @since 0.5.0
 * @category keys
 */
export const generateEcdsaKeyPair = (): Effect.Effect<
  KeyPair.KeyPair,
  KeyPair.GenerationFailed,
  Entropy.Entropy
> =>
  Entropy.bytes(48).pipe(
    Effect.mapError(() =>
      new KeyPair.GenerationFailed({ algorithm: "secp256k1-ecdsa", reason: "Key generation entropy unavailable" })
    ),
    Effect.flatMap((seed) =>
      Effect.try({
        try: () => {
          const { secretKey, publicKey } = secp256k1.keygen(seed)
          return new KeyPair.KeyPair({ algorithm: "secp256k1-ecdsa", publicKey, secretKey })
        },
        catch: (cause) =>
          new KeyPair.GenerationFailed({ algorithm: "secp256k1-ecdsa", reason: Cause.pretty(Cause.fail(cause)) })
      })
    )
  )

/**
 * Signs exact message bytes with BIP-340 Schnorr and auxiliary entropy.
 * Requires Entropy.Entropy for 32 fresh auxiliary bytes. Produces a 64-byte
 * signature from a 32-byte secret scalar. The supplied x-only public key is
 * stored without copying or pair validation. Message length is unrestricted
 * (BIP-340 variable-length extension); the operation does not prehash or frame it.
 *
 * @since 0.5.0
 * @category signing
 */
export const signSchnorr = (
  message: Uint8Array,
  secretKey: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<Signature.Signature, Signature.SigningFailed, Entropy.Entropy> =>
  Entropy.bytes(32).pipe(
    Effect.mapError(() =>
      new Signature.SigningFailed({ algorithm: "secp256k1-schnorr", reason: "Signing entropy unavailable" })
    ),
    Effect.flatMap((auxRand) =>
      Effect.try({
        try: () =>
          new Signature.Signature({
            algorithm: "secp256k1-schnorr",
            signature: schnorr.sign(message, secretKey, auxRand),
            publicKey
          }),
        catch: (error) =>
          new Signature.SigningFailed({ algorithm: "secp256k1-schnorr", reason: Cause.pretty(Cause.fail(error)) })
      })
    )
  )

/**
 * Verifies a BIP-340 Schnorr signature.
 * Takes 64 signature bytes, exact unframed message bytes, and a 32-byte x-only
 * public key. Nonmatches return false; backend exceptions become the diagnostic
 * Signature.VerificationFailed. Does not authenticate the public key.
 *
 * @since 0.5.0
 * @category verification
 */
export const verifySchnorr = (
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<boolean, Signature.VerificationFailed> =>
  Effect.try({
    try: () => schnorr.verify(signature, message, publicKey),
    catch: (error) =>
      new Signature.VerificationFailed({ algorithm: "secp256k1-schnorr", reason: Cause.pretty(Cause.fail(error)) })
  })

/**
 * Generates a BIP-340 key pair from 48 bytes of explicit entropy.
 * Requires Entropy.Entropy. Returns a 32-byte secret scalar and 32-byte x-only
 * public key; failures become KeyPair.GenerationFailed.
 *
 * @since 0.5.0
 * @category keys
 */
export const generateSchnorrKeyPair = (): Effect.Effect<
  KeyPair.KeyPair,
  KeyPair.GenerationFailed,
  Entropy.Entropy
> =>
  Entropy.bytes(48).pipe(
    Effect.mapError(() =>
      new KeyPair.GenerationFailed({ algorithm: "secp256k1-schnorr", reason: "Key generation entropy unavailable" })
    ),
    Effect.flatMap((seed) =>
      Effect.try({
        try: () => {
          const { secretKey, publicKey } = schnorr.keygen(seed)
          return new KeyPair.KeyPair({ algorithm: "secp256k1-schnorr", publicKey, secretKey })
        },
        catch: (cause) =>
          new KeyPair.GenerationFailed({ algorithm: "secp256k1-schnorr", reason: Cause.pretty(Cause.fail(cause)) })
      })
    )
  )
