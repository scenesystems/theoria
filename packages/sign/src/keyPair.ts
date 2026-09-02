/**
 * Generates key pairs for the package's signature, agreement, and KEM suites.
 *
 * The selected Noble primitive obtains randomness from the platform CSPRNG.
 *
 * @since 0.1.0
 * @category keys
 */
import { Effect, Match } from "effect"
import { ed25519Keygen } from "./algorithms/ed25519.js"
import { xwingKeygen } from "./algorithms/hybrid.js"
import { mlDsa44Keygen, mlDsa65Keygen, mlDsa87Keygen } from "./algorithms/mlDsa.js"
import { secp256k1EcdsaKeygen, secp256k1SchnorrKeygen } from "./algorithms/secp256k1.js"
import {
  slhDsaSha2128fKeygen,
  slhDsaSha2128sKeygen,
  slhDsaSha2192fKeygen,
  slhDsaSha2256fKeygen
} from "./algorithms/slhDsa.js"
import { x25519Keygen } from "./algorithms/x25519.js"
import { KeyGenerationFailed } from "./schemas/errors.js"
import type { KeyPair } from "./schemas/KeyPair.js"
import type { CryptoAlgorithm } from "./schemas/KeyPair.js"

type CryptoAlgorithmType = typeof CryptoAlgorithm.Type

/**
 * Generates a key pair for one supported suite.
 *
 * @remarks
 * Randomness is obtained by the selected Noble primitive. The returned byte
 * arrays are owned by the caller; this package does not store, wrap, redact, or
 * destroy secret keys.
 *
 * @param algorithm - The exact signature, agreement, or KEM suite to generate.
 * @returns A caller-owned, algorithm-tagged key pair. Backend failures
 * are normalized to `KeyGenerationFailed` with an algorithm and diagnostic
 * reason.
 *
 * @since 0.1.0
 * @category keys
 */
export const generateKeyPair = (
  algorithm: CryptoAlgorithmType
): Effect.Effect<KeyPair, KeyGenerationFailed> =>
  Match.value(algorithm).pipe(
    Match.when("ed25519", () => ed25519Keygen()),
    Match.when("secp256k1-ecdsa", () => secp256k1EcdsaKeygen()),
    Match.when("secp256k1-schnorr", () => secp256k1SchnorrKeygen()),
    Match.when("ml-dsa-44", () => mlDsa44Keygen()),
    Match.when("ml-dsa-65", () => mlDsa65Keygen()),
    Match.when("ml-dsa-87", () => mlDsa87Keygen()),
    Match.when("slh-dsa-sha2-128f", () => slhDsaSha2128fKeygen()),
    Match.when("slh-dsa-sha2-128s", () => slhDsaSha2128sKeygen()),
    Match.when("slh-dsa-sha2-192f", () => slhDsaSha2192fKeygen()),
    Match.when("slh-dsa-sha2-256f", () => slhDsaSha2256fKeygen()),
    Match.when("x25519", () => x25519Keygen()),
    Match.when("xwing", () => xwingKeygen()),
    Match.exhaustive
  ).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new KeyGenerationFailed({ algorithm, reason: String(error) })
      )
    )
  )
