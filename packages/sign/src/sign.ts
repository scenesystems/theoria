/**
 * Unified sign/verify pipeline.
 *
 * Dispatches to the appropriate algorithm implementation based on
 * a {@link SignatureAlgorithm} discriminant, providing a single
 * API surface for all digital signature operations.
 *
 * Verification follows the inverse path — the algorithm tag on the
 * signature determines which verifier to use, ensuring signatures
 * are always verified with the correct algorithm.
 *
 * @see {@link SignatureAlgorithm} — supported algorithm literals (source of truth)
 * @see {@link agreement} — key agreement pipeline
 * @see {@link kem} — key encapsulation pipeline
 * @see {@link generateKeyPair} — key generation for all algorithms
 *
 * @since 0.1.0
 * @category signing
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
import {
  BatchVerifyError,
  BatchVerifyMismatch,
  BatchVerifyPass,
  BatchVerifyReport,
  type BatchVerifyRequestType
} from "./schemas/BatchVerification.js"
import { DetachedSignature } from "./schemas/DetachedSignature.js"
import type { SigningFailed, VerificationFailed } from "./schemas/errors.js"
import { Signature } from "./schemas/Signature.js"
import type { SignatureAlgorithm } from "./schemas/SignatureAlgorithm.js"

type SignatureAlgorithmType = typeof SignatureAlgorithm.Type

/**
 * Sign a message with the specified algorithm.
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
 * Sign a message into a detached, portable carrier.
 *
 * The detached carrier omits the public key so identity material can travel on
 * its own boundary, while callers still reuse the same algorithm-native signing
 * implementations as the self-describing {@link sign} surface.
 *
 * @since 0.2.0
 * @category signing
 */
export const signDetached = (
  algorithm: SignatureAlgorithmType,
  message: Uint8Array,
  secretKey: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<DetachedSignature, SigningFailed> =>
  sign(algorithm, message, secretKey, publicKey).pipe(
    Effect.map(
      (signature) =>
        new DetachedSignature({
          algorithm: signature.algorithm,
          signature: signature.signature
        })
    )
  )

/**
 * Verify a self-describing signature against a message.
 *
 * Dispatches to the correct verifier based on the signature's
 * `algorithm` field.
 *
 * @since 0.1.0
 * @category signing
 */
export const verify = (
  sig: Signature,
  message: Uint8Array
): Effect.Effect<boolean, VerificationFailed> =>
  Match.value(sig.algorithm).pipe(
    Match.when("ed25519", () => ed25519Verify(sig.signature, message, sig.publicKey)),
    Match.when("secp256k1-ecdsa", () => secp256k1EcdsaVerify(sig.signature, message, sig.publicKey)),
    Match.when("secp256k1-schnorr", () => secp256k1SchnorrVerify(sig.signature, message, sig.publicKey)),
    Match.when("ml-dsa-44", () => mlDsa44Verify(sig.signature, message, sig.publicKey)),
    Match.when("ml-dsa-65", () => mlDsa65Verify(sig.signature, message, sig.publicKey)),
    Match.when("ml-dsa-87", () => mlDsa87Verify(sig.signature, message, sig.publicKey)),
    Match.when("slh-dsa-sha2-128f", () => slhDsaSha2128fVerify(sig.signature, message, sig.publicKey)),
    Match.when("slh-dsa-sha2-128s", () => slhDsaSha2128sVerify(sig.signature, message, sig.publicKey)),
    Match.when("slh-dsa-sha2-192f", () => slhDsaSha2192fVerify(sig.signature, message, sig.publicKey)),
    Match.when("slh-dsa-sha2-256f", () => slhDsaSha2256fVerify(sig.signature, message, sig.publicKey)),
    Match.exhaustive
  )

/**
 * Verify a detached signature with an explicit public key.
 *
 * Detached verification reconstructs the self-describing carrier at the
 * boundary only long enough to reuse the canonical verifier dispatch. The
 * detached artifact itself never stores identity material.
 *
 * @since 0.2.0
 * @category signing
 */
export const verifyDetached = (
  signature: DetachedSignature,
  message: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<boolean, VerificationFailed> =>
  verify(
    new Signature({
      algorithm: signature.algorithm,
      signature: signature.signature,
      publicKey
    }),
    message
  )

const verifyRequest = (
  request: BatchVerifyRequestType
): Effect.Effect<boolean, VerificationFailed> =>
  request.kind === "detached"
    ? verifyDetached(request.signature, request.message, request.publicKey)
    : verify(request.signature, request.message)

/**
 * Verify a batch of signatures while preserving per-item order and outcome.
 *
 * The batch report is additive to the single-item `verify` and
 * `verifyDetached` APIs: every request reuses the canonical verifier path, but
 * mismatches and malformed signatures are captured per item so one bad input
 * does not erase the rest of the batch.
 *
 * @since 0.2.0
 * @category signing
 */
export const batchVerify = (
  requests: ReadonlyArray<BatchVerifyRequestType>
): Effect.Effect<BatchVerifyReport> =>
  Effect.forEach(requests, (request, index) =>
    verifyRequest(request).pipe(
      Effect.match({
        onFailure: (error) =>
          new BatchVerifyError({
            index,
            algorithm: request.signature.algorithm,
            error
          }),
        onSuccess: (verified) =>
          verified
            ? new BatchVerifyPass({
              index,
              algorithm: request.signature.algorithm
            })
            : new BatchVerifyMismatch({
              index,
              algorithm: request.signature.algorithm,
              reason: "signature-mismatch"
            })
      })
    )).pipe(
      Effect.map((results) => {
        const verifiedCount = results.filter((result) => result._tag === "BatchVerifyPass").length
        return new BatchVerifyReport({
          allValid: verifiedCount === results.length,
          verifiedCount,
          failedCount: results.length - verifiedCount,
          results
        })
      })
    )
