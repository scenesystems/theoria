/**
 * Implements the ML-DSA-44, ML-DSA-65, and ML-DSA-87 FIPS 204 signature
 * suites through `@noble/post-quantum`.
 *
 * @remarks
 * ML-DSA-44 uses 1,312-byte public keys, 2,560-byte secret keys, and
 * 2,420-byte signatures. ML-DSA-65 uses 1,952, 4,032, and 3,309 bytes.
 * ML-DSA-87 uses 2,592, 4,896, and 4,627 bytes. The ML-DSA-44 and ML-DSA-87
 * wrappers use Noble's default signing profile. ML-DSA-65 exposes separate
 * deterministic and caller-hedged operations.
 * @since 0.1.0
 * @category algorithms
 * @module
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
 * Produces a 2,420-byte pure ML-DSA-44 signature with Noble's default hedged
 * signing profile (empty context and ambient CSPRNG entropy).
 * @since 0.1.0
 * @category algorithms
 */
export const mlDsa44Sign = dsa44.sign

/**
 * Checks a 2,420-byte pure ML-DSA-44 signature with a 1,312-byte public key and
 * empty context. A cryptographic nonmatch returns `false`; malformed input or a
 * backend exception fails with `VerificationFailed`.
 * @since 0.1.0
 * @category algorithms
 */
export const mlDsa44Verify = dsa44.verify

/**
 * Draws an ML-DSA-44 key pair from Noble's ambient CSPRNG (1,312-byte public
 * key and 2,560-byte secret key).
 * @since 0.1.0
 * @category algorithms
 */
export const mlDsa44Keygen = dsa44.keygen

/**
 * Signs with deterministic ML-DSA-65 for conformance use.
 *
 * @remarks
 * This operation never reads ambient randomness. Production signing should use `mlDsa65SignHedged`
 * with fresh caller-supplied cryptographic entropy.
 * Its three-argument signature uses the pure ML-DSA-65 empty-context profile and stores the
 * supplied public key in the returned carrier.
 * @since 0.1.1
 * @category algorithms
 */
export const mlDsa65SignDeterministic = dsa65.sign

/**
 * Legacy ML-DSA-65 signing entrypoint without explicit entropy.
 *
 * @remarks
 * It now fails closed because its historical signature cannot supply explicit hedging entropy. Use
 * `mlDsa65SignHedged` for production signing or `mlDsa65SignDeterministic` for conformance.
 *
 * @deprecated Deprecated since 0.1.1. Use `mlDsa65SignHedged` for production
 * signing or `mlDsa65SignDeterministic` for conformance; the legacy operation
 * always fails because it cannot accept explicit entropy.
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
 * Signs with pure ML-DSA-65 using exactly 32 bytes of caller-supplied entropy.
 *
 * @remarks
 * The final argument is passed to Noble as `extraEntropy`; ambient randomness is never
 * consulted. Inputs are detached before primitive execution.
 *
 * @param message - Protected message bytes, at most 8,192 bytes.
 * @param secretKey - Exactly 4,032 ML-DSA-65 secret-key bytes.
 * @param publicKey - Exactly 1,952 public-key bytes stored in the result.
 * @param context - FIPS 204 context bytes, from 0 through 255 bytes.
 * @param entropy32 - Exactly 32 fresh cryptographically random bytes.
 * @returns An ML-DSA-65 `Signature`, or `SigningFailed`.
 * The failure reason is limited to `invalid input` or `backend unavailable`.
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
 * Verifies a detached pure ML-DSA-65 signature with an explicit FIPS 204 context.
 *
 * @remarks
 * The key and signature sizes, context bound, and canonical hint encoding are
 * admitted before Noble executes. A structurally valid signature that does not
 * match returns `false`.
 *
 * Inputs are copied when the Effect executes. Messages longer than 8,192 bytes and contexts longer
 * than 255 bytes fail admission. A different context normally produces `false`.
 *
 * @param signature - Exactly 3,309 pure ML-DSA-65 signature bytes.
 * @param message - Protected message bytes, at most 8,192 bytes.
 * @param publicKey - Exactly 1,952 pure ML-DSA-65 public-key bytes.
 * @param context - Explicit FIPS 204 context, at most 255 bytes.
 * @returns `true` for a match, `false` for an admitted nonmatch, or a
 * material-free typed admission or backend failure.
 * @see https://doi.org/10.6028/NIST.FIPS.204
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
 * Draws an ML-DSA-65 key pair from Noble's ambient CSPRNG (1,952-byte public
 * key and 4,032-byte secret key).
 * @since 0.1.0
 * @category algorithms
 */
export const mlDsa65Keygen = dsa65.keygen

/**
 * Produces a 4,627-byte pure ML-DSA-87 signature with Noble's default hedged
 * signing profile (empty context and ambient CSPRNG entropy).
 *
 * @since 0.1.0
 * @category algorithms
 */
export const mlDsa87Sign = dsa87.sign

/**
 * Checks a 4,627-byte pure ML-DSA-87 signature with a 2,592-byte public key and
 * empty context. A cryptographic nonmatch returns `false`; malformed input or a
 * backend exception fails with `VerificationFailed`.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const mlDsa87Verify = dsa87.verify

/**
 * Draws an ML-DSA-87 key pair from Noble's ambient CSPRNG (2,592-byte public
 * key and 4,896-byte secret key).
 * @since 0.1.0
 * @category algorithms
 */
export const mlDsa87Keygen = dsa87.keygen
