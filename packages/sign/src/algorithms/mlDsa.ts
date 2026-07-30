/**
 * ML-DSA (Module-Lattice Digital Signature Algorithm) post-quantum signatures.
 *
 * Post-quantum signature algorithm standardized as FIPS-204 (formerly
 * known as CRYSTALS-Dilithium). Primary post-quantum signature scheme
 * for long-lived content provenance that must survive quantum computing.
 *
 * Wraps `@noble/post-quantum/ml-dsa` — audited, zero-dependency.
 * Lattice-based construction over Module-LWE (Learning with Errors).
 *
 * Three security levels:
 * - **ML-DSA-44** (NIST Level 2): 1312B pk, 2560B sk, 2420B sig
 * - **ML-DSA-65** (NIST Level 3): 1952B pk, 4032B sk, 3309B sig
 * - **ML-DSA-87** (NIST Level 5): 2592B pk, 4896B sk, 4627B sig
 *
 * ML-DSA-65 is recommended for most applications — it provides
 * 192-bit post-quantum security (NIST Level 3) with moderate key
 * and signature sizes.
 *
 * Security property: EUF-CMA under Module-LWE hardness assumption.
 * ML-DSA signing is hedged by default in Noble. This package's explicit
 * ML-DSA-65 operation requires 32 bytes of caller-supplied entropy so it never
 * reads ambient randomness. Signatures are larger than classical (~3.3KB vs
 * 64B for Ed25519) — this is the cost of quantum resistance.
 *
 * @see {@link slhDsa} — alternative post-quantum (hash-based, conservative)
 * @see {@link hybrid} — classical + post-quantum hybrid for transition
 * @see {@link ed25519} — classical alternative (faster, smaller, not quantum-safe)
 *
 * @since 0.1.0
 * @category algorithms
 */
import { ml_dsa44, ml_dsa65, ml_dsa87 } from "@noble/post-quantum/ml-dsa.js"
import { Effect } from "effect"
import {
  hasInvalidMlDsa65HintEncoding,
  ML_DSA_65_ENTROPY_BYTES,
  ML_DSA_65_PUBLIC_KEY_BYTES,
  ML_DSA_65_SECRET_KEY_BYTES,
  ML_DSA_65_SIGNATURE_BYTES
} from "../internal/mlDsa65.js"
import { makePqOps } from "../internal/pqSignatureOps.js"
import {
  detachMlDsaVerificationInputs,
  DIRECT_VERIFICATION_MAX_MESSAGE_BYTES,
  ML_DSA_MAX_CONTEXT_BYTES
} from "../internal/verificationInput.js"
import { InvalidVerificationInput, SigningFailed, VerificationUnavailable } from "../schemas/errors.js"
import { Signature } from "../schemas/Signature.js"

const dsa44 = makePqOps("ml-dsa-44", ml_dsa44)
const EMPTY_CONTEXT = new Uint8Array(0)
const dsa65 = makePqOps("ml-dsa-65", {
  keygen: ml_dsa65.keygen,
  sign: (message, secretKey) => ml_dsa65.sign(message, secretKey, { context: EMPTY_CONTEXT, extraEntropy: false }),
  verify: (signature, message, publicKey) => ml_dsa65.verify(signature, message, publicKey, { context: EMPTY_CONTEXT })
})
const dsa87 = makePqOps("ml-dsa-87", ml_dsa87)

/**
 * Sign a message with ML-DSA-44.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const mlDsa44Sign = dsa44.sign

/**
 * Verify an ML-DSA-44 signature against a message and public key.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const mlDsa44Verify = dsa44.verify

/**
 * Generate an ML-DSA-44 key pair.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const mlDsa44Keygen = dsa44.keygen

/**
 * Deterministically sign a message with ML-DSA-65 for conformance use.
 *
 * This operation never reads ambient randomness. Production signing should use
 * `mlDsa65SignHedged` with fresh caller-supplied cryptographic entropy.
 *
 * @since 0.1.1
 * @category algorithms
 */
export const mlDsa65SignDeterministic = dsa65.sign

/**
 * Legacy ML-DSA-65 signing entrypoint without explicit entropy.
 *
 * It now fails closed because its historical signature cannot supply explicit
 * hedging entropy. Use `mlDsa65SignHedged` for production signing or the
 * explicitly named `mlDsa65SignDeterministic` for conformance.
 *
 * @deprecated Use an explicitly named signing mode.
 * @since 0.1.0
 * @category algorithms
 */
export const mlDsa65Sign = (
  _message: Uint8Array,
  _secretKey: Uint8Array,
  _publicKey: Uint8Array
): Effect.Effect<never, SigningFailed> =>
  Effect.fail(new SigningFailed({ algorithm: "ml-dsa-65", reason: "explicit signing mode required" }))

/**
 * Sign with pure ML-DSA-65 using exactly 32 bytes of caller-supplied entropy.
 *
 * The final argument is passed to Noble as `extraEntropy`; ambient randomness
 * is therefore never consulted. Inputs are detached before primitive execution.
 *
 * @since 0.1.1
 * @category algorithms
 */
export const mlDsa65SignHedged = (
  message: Uint8Array,
  secretKey: Uint8Array,
  publicKey: Uint8Array,
  context: Uint8Array,
  entropy32: Uint8Array
): Effect.Effect<Signature, SigningFailed> => {
  if (
    !(message instanceof Uint8Array) ||
    !(secretKey instanceof Uint8Array) ||
    !(publicKey instanceof Uint8Array) ||
    !(context instanceof Uint8Array) ||
    !(entropy32 instanceof Uint8Array) ||
    message.length > DIRECT_VERIFICATION_MAX_MESSAGE_BYTES ||
    secretKey.length !== ML_DSA_65_SECRET_KEY_BYTES ||
    publicKey.length !== ML_DSA_65_PUBLIC_KEY_BYTES ||
    context.length > ML_DSA_MAX_CONTEXT_BYTES ||
    entropy32.length !== ML_DSA_65_ENTROPY_BYTES
  ) {
    return Effect.fail(new SigningFailed({ algorithm: "ml-dsa-65", reason: "invalid input" }))
  }

  const detachedMessage = Uint8Array.from(message)
  const detachedSecretKey = Uint8Array.from(secretKey)
  const detachedPublicKey = Uint8Array.from(publicKey)
  const detachedContext = Uint8Array.from(context)
  const detachedEntropy = Uint8Array.from(entropy32)
  return Effect.try({
    try: () =>
      ml_dsa65.sign(detachedMessage, detachedSecretKey, {
        context: detachedContext,
        extraEntropy: detachedEntropy
      }),
    catch: () => new SigningFailed({ algorithm: "ml-dsa-65", reason: "backend unavailable" })
  }).pipe(
    Effect.map((signature) => new Signature({ algorithm: "ml-dsa-65", signature, publicKey: detachedPublicKey }))
  )
}

/**
 * Verify a detached pure ML-DSA-65 signature with an explicit FIPS 204 context.
 *
 * The key and signature sizes, context bound, and canonical hint encoding are
 * admitted before Noble executes. A structurally valid signature that does not
 * match returns `false`.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const mlDsa65Verify = (
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array,
  context: Uint8Array
): Effect.Effect<boolean, InvalidVerificationInput | VerificationUnavailable> => {
  const detached = detachMlDsaVerificationInputs(signature, message, publicKey, context)
  return detached.pipe(Effect.flatMap((input) =>
    Effect.gen(function*() {
      if (
        input.signature.length !== ML_DSA_65_SIGNATURE_BYTES ||
        input.publicKey.length !== ML_DSA_65_PUBLIC_KEY_BYTES ||
        hasInvalidMlDsa65HintEncoding(input.signature)
      ) {
        return yield* new InvalidVerificationInput({})
      }

      return yield* Effect.try({
        try: () => ml_dsa65.verify(input.signature, input.message, input.publicKey, { context: input.context }),
        catch: () => new VerificationUnavailable({})
      })
    })
  ))
}

/**
 * Generate an ML-DSA-65 key pair.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const mlDsa65Keygen = dsa65.keygen

/**
 * Sign a message with ML-DSA-87.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const mlDsa87Sign = dsa87.sign

/**
 * Verify an ML-DSA-87 signature against a message and public key.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const mlDsa87Verify = dsa87.verify

/**
 * Generate an ML-DSA-87 key pair.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const mlDsa87Keygen = dsa87.keygen
