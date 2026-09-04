/**
 * Dispatches signing and verification through the selected signature suite.
 *
 * @since 0.1.0
 * @category signing
 * @module
 */
import { Effect, Match } from "effect"
import { ed25519Sign, ed25519Verify } from "./algorithms/ed25519.js"
import {
  mlDsa44Sign,
  mlDsa44Verify,
  mlDsa65Sign,
  mlDsa65Verify,
  mlDsa87Sign,
  mlDsa87Verify
} from "./algorithms/mlDsa.js"
import {
  secp256k1EcdsaSign,
  secp256k1EcdsaVerify,
  secp256k1SchnorrSign,
  secp256k1SchnorrVerify
} from "./algorithms/secp256k1.js"
import {
  slhDsaSha2128fSign,
  slhDsaSha2128fVerify,
  slhDsaSha2128sSign,
  slhDsaSha2128sVerify,
  slhDsaSha2192fSign,
  slhDsaSha2192fVerify,
  slhDsaSha2256fSign,
  slhDsaSha2256fVerify
} from "./algorithms/slhDsa.js"
import { type SigningFailed, VerificationFailed } from "./schemas/errors.js"
import type { Signature } from "./schemas/Signature.js"
import type { SignatureAlgorithm } from "./schemas/SignatureAlgorithm.js"

type SignatureAlgorithmType = typeof SignatureAlgorithm.Type

/**
 * Signs exact message bytes with the selected suite and attaches the supplied
 * public key to the result.
 *
 * @remarks
 * `publicKey` is stored in the returned carrier; signing uses `secretKey`.
 * The function does not establish that those keys form a pair. The
 * `"ml-dsa-65"` branch always fails closed: use `mlDsa65SignHedged` or
 * `mlDsa65SignDeterministic` explicitly.
 *
 * @param algorithm - The signing suite and output algorithm tag.
 * @param message - The exact bytes to sign; no framing or domain separation is added.
 * @param secretKey - Secret key accepted by the selected primitive.
 * @param publicKey - Public key attached to the returned `Signature`.
 * @returns The algorithm-tagged signature carrier, or `SigningFailed`.
 *
 * @since 0.1.0
 * @category signing
 */
export const sign = (
  algorithm: SignatureAlgorithmType,
  message: Uint8Array,
  secretKey: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<Signature, SigningFailed> =>
  Match.value(algorithm).pipe(
    Match.when("ed25519", () => ed25519Sign(message, secretKey, publicKey)),
    Match.when("secp256k1-ecdsa", () => secp256k1EcdsaSign(message, secretKey, publicKey)),
    Match.when("secp256k1-schnorr", () => secp256k1SchnorrSign(message, secretKey, publicKey)),
    Match.when("ml-dsa-44", () => mlDsa44Sign(message, secretKey, publicKey)),
    Match.when("ml-dsa-65", () => mlDsa65Sign(message, secretKey, publicKey)),
    Match.when("ml-dsa-87", () => mlDsa87Sign(message, secretKey, publicKey)),
    Match.when("slh-dsa-sha2-128f", () => slhDsaSha2128fSign(message, secretKey, publicKey)),
    Match.when("slh-dsa-sha2-128s", () => slhDsaSha2128sSign(message, secretKey, publicKey)),
    Match.when("slh-dsa-sha2-192f", () => slhDsaSha2192fSign(message, secretKey, publicKey)),
    Match.when("slh-dsa-sha2-256f", () => slhDsaSha2256fSign(message, secretKey, publicKey)),
    Match.exhaustive
  )

/**
 * Verifies exact message bytes using the suite and public key stored in the
 * signature.
 *
 * @remarks
 * The verification key comes from `sig`; callers that authenticate or
 * select a key independently should use an algorithm-specific verifier.
 * A well-formed nonmatching signature returns `false`; primitive exceptions are
 * represented by `VerificationFailed` (strict direct verifiers use their own
 * redacted failure types).
 *
 * @param sig - Signature bytes, algorithm selection, and verification key.
 * @param message - The exact bytes expected to have been signed.
 * @returns `true` for a match, `false` for an admitted nonmatch, or
 * `VerificationFailed` when the selected verifier cannot process its input.
 *
 * @since 0.1.0
 * @category signing
 */
export const verify = (
  sig: Signature,
  message: Uint8Array
): Effect.Effect<boolean, VerificationFailed> =>
  Match.value(sig.algorithm).pipe(
    Match.when("ed25519", () =>
      ed25519Verify(sig.signature, message, sig.publicKey).pipe(
        Effect.mapError(() => new VerificationFailed({ algorithm: "ed25519", reason: "verification rejected" }))
      )),
    Match.when("secp256k1-ecdsa", () => secp256k1EcdsaVerify(sig.signature, message, sig.publicKey)),
    Match.when("secp256k1-schnorr", () => secp256k1SchnorrVerify(sig.signature, message, sig.publicKey)),
    Match.when("ml-dsa-44", () => mlDsa44Verify(sig.signature, message, sig.publicKey)),
    Match.when("ml-dsa-65", () =>
      mlDsa65Verify(sig.signature, message, sig.publicKey, new Uint8Array(0)).pipe(
        Effect.mapError(() => new VerificationFailed({ algorithm: "ml-dsa-65", reason: "verification rejected" }))
      )),
    Match.when("ml-dsa-87", () => mlDsa87Verify(sig.signature, message, sig.publicKey)),
    Match.when("slh-dsa-sha2-128f", () => slhDsaSha2128fVerify(sig.signature, message, sig.publicKey)),
    Match.when("slh-dsa-sha2-128s", () => slhDsaSha2128sVerify(sig.signature, message, sig.publicKey)),
    Match.when("slh-dsa-sha2-192f", () => slhDsaSha2192fVerify(sig.signature, message, sig.publicKey)),
    Match.when("slh-dsa-sha2-256f", () => slhDsaSha2256fVerify(sig.signature, message, sig.publicKey)),
    Match.exhaustive
  )
