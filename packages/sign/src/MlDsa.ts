/**
 * ML-DSA-44, ML-DSA-65, and ML-DSA-87 signature operations.
 * FIPS 204 pure signatures, not prehash variants. The 44/87 operations use an
 * empty context. The strict 65 verifier and caller-hedged signer admit bounded
 * messages and explicit contexts. No operation authenticates a supplied key.
 *
 * @since 0.5.0
 * @module
 */
import { ml_dsa44, ml_dsa65, ml_dsa87 } from "@noble/post-quantum/ml-dsa.js"
import { Boolean as B, Effect, identity, Number as N, Record, Schema } from "effect"
import { hasInvalidMlDsa65HintEncoding } from "./internal/mlDsa65.js"
import { makeDeterministicPqSign, makePqOps } from "./internal/pqSignatureOps.js"
import { copyBytes, detachMlDsaVerificationInputs } from "./internal/verificationInput.js"
import * as Signature from "./Signature.js"
import * as Verification from "./Verification.js"

/**
 * Maximum FIPS 204 context length.
 *
 * @since 0.5.0
 * @category constants
 */
export const maxContextBytes = 255

/**
 * ML-DSA signing entropy length.
 *
 * @since 0.5.0
 * @category constants
 */
export const entropyBytes = 32

const publicKeyBytes65 = 1_952
const secretKeyBytes65 = 4_032
const signatureBytes65 = 3_309

const Context = Schema.Uint8ArrayFromSelf.pipe(
  Schema.filter((bytes) => N.lessThanOrEqualTo(bytes.length, maxContextBytes))
)

const HedgedInput = Schema.Struct({
  message: Schema.Uint8ArrayFromSelf.pipe(
    Schema.filter((bytes) => N.lessThanOrEqualTo(bytes.length, Verification.maxMessageBytes))
  ),
  secretKey: Schema.Uint8ArrayFromSelf.pipe(
    Schema.filter((bytes) => N.Equivalence(bytes.length, secretKeyBytes65))
  ),
  publicKey: Schema.Uint8ArrayFromSelf.pipe(
    Schema.filter((bytes) => N.Equivalence(bytes.length, publicKeyBytes65))
  ),
  context: Context,
  entropy: Schema.Uint8ArrayFromSelf.pipe(
    Schema.filter((bytes) => N.Equivalence(bytes.length, entropyBytes))
  )
})

const dsa44 = makePqOps("ml-dsa-44", ml_dsa44, 32, entropyBytes)
const dsa65 = makePqOps("ml-dsa-65", ml_dsa65, 32, entropyBytes)
const dsa87 = makePqOps("ml-dsa-87", ml_dsa87, 32, entropyBytes)

/**
 * Signs with hedged ML-DSA-44.
 * Requires Entropy.Entropy for 32 bytes; uses an empty context and a 2,560-byte
 * secret key. Returns a 2,420-byte signature and the supplied public key,
 * without copying or pair validation. Failures are Signature.SigningFailed.
 *
 * @since 0.5.0
 * @category signing
 */
export const sign44 = dsa44.sign

/**
 * Verifies an ML-DSA-44 signature.
 * Takes a 2,420-byte signature, exact message, and 1,312-byte public key with
 * empty context. Nonmatches are false; exceptions are Signature.VerificationFailed.
 *
 * @since 0.5.0
 * @category verification
 */
export const verify44 = dsa44.verify

/**
 * Generates an ML-DSA-44 key pair.
 * Requires Entropy.Entropy for a 32-byte seed. Returns a 1,312-byte public key
 * and 2,560-byte secret key; failures are KeyPair.GenerationFailed.
 *
 * @since 0.5.0
 * @category keys
 */
export const generateKeyPair44 = dsa44.keygen

/**
 * Signs with deterministic, empty-context ML-DSA-65.
 * Intended for conformance vectors; production should use sign65Hedged. Requires
 * no Entropy. Takes a 4,032-byte secret key, returns a 3,309-byte signature, and
 * stores the supplied public key without copying or pair validation.
 *
 * @since 0.5.0
 * @category signing
 */
export const sign65Deterministic = makeDeterministicPqSign("ml-dsa-65", ml_dsa65)

/**
 * Signs with ML-DSA-65 using caller-provided context and hedging entropy.
 * Requires exactly entropyBytes (32) fresh cryptographic bytes and at most
 * maxContextBytes (255) context bytes. Secret/public keys are 4,032/1,952 bytes;
 * messages are bounded by Verification.maxMessageBytes. Inputs are validated
 * and copied on execution, including hostile or detached buffers. Does not
 * prove that the supplied keys form a pair. Requires no Entropy service because
 * the caller supplies entropy explicitly. SigningFailed reasons are restricted
 * to `invalid input` and `backend unavailable`.
 *
 * @since 0.5.0
 * @category signing
 */
export const sign65Hedged = (
  message: Uint8Array,
  secretKey: Uint8Array,
  publicKey: Uint8Array,
  context: Uint8Array,
  entropy32: Uint8Array
): Effect.Effect<Signature.Signature, Signature.SigningFailed> =>
  Effect.try({
    try: () => Schema.decodeUnknownEither(HedgedInput)({ message, secretKey, publicKey, context, entropy: entropy32 }),
    catch: () => new Signature.SigningFailed({ algorithm: "ml-dsa-65", reason: "invalid input" })
  }).pipe(
    Effect.flatMap(identity),
    Effect.flatMap((input) => Effect.all(Record.map(input, copyBytes))),
    Effect.mapError(() => new Signature.SigningFailed({ algorithm: "ml-dsa-65", reason: "invalid input" })),
    Effect.flatMap((input) =>
      Effect.try({
        try: () =>
          ml_dsa65.sign(input.message, input.secretKey, { context: input.context, extraEntropy: input.entropy }),
        catch: () => new Signature.SigningFailed({ algorithm: "ml-dsa-65", reason: "backend unavailable" })
      }).pipe(
        Effect.map((signature) =>
          new Signature.Signature({ algorithm: "ml-dsa-65", signature, publicKey: input.publicKey })
        )
      )
    )
  )

/**
 * Verifies ML-DSA-65 with an explicit FIPS 204 context.
 * Requires a 3,309-byte signature with canonical hint encoding and a 1,952-byte
 * public key. Admits at most maxContextBytes context bytes and
 * Verification.maxMessageBytes message bytes, then snapshots inputs on each
 * execution. A different context normally yields false. Malformed input fails
 * with Verification.InvalidInput; backend exceptions with Verification.Unavailable.
 * Both failures are material-free. The primitive executes synchronously.
 *
 * @since 0.5.0
 * @category verification
 */
export const verify65 = (
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array,
  context: Uint8Array
): Effect.Effect<boolean, Verification.InvalidInput | Verification.Unavailable> =>
  detachMlDsaVerificationInputs(signature, message, publicKey, context, Context).pipe(
    Effect.filterOrFail(
      (input) =>
        B.and(
          N.Equivalence(input.signature.length, signatureBytes65),
          N.Equivalence(input.publicKey.length, publicKeyBytes65)
        ),
      () => new Verification.InvalidInput({})
    ),
    Effect.filterOrFail(
      (input) => B.not(hasInvalidMlDsa65HintEncoding(input.signature)),
      () => new Verification.InvalidInput({})
    ),
    Effect.flatMap((input) =>
      Effect.try({
        try: () => ml_dsa65.verify(input.signature, input.message, input.publicKey, { context: input.context }),
        catch: () => new Verification.Unavailable({})
      })
    )
  )

/**
 * Generates an ML-DSA-65 key pair.
 * Requires Entropy.Entropy for a 32-byte seed. Returns a 1,952-byte public key
 * and 4,032-byte secret key; failures are KeyPair.GenerationFailed.
 *
 * @since 0.5.0
 * @category keys
 */
export const generateKeyPair65 = dsa65.keygen

/**
 * Signs with hedged ML-DSA-87.
 * Requires Entropy.Entropy for 32 bytes; uses an empty context and a 4,896-byte
 * secret key. Returns a 4,627-byte signature and the supplied public key,
 * without copying or pair validation. Failures are Signature.SigningFailed.
 *
 * @since 0.5.0
 * @category signing
 */
export const sign87 = dsa87.sign

/**
 * Verifies an ML-DSA-87 signature.
 * Takes a 4,627-byte signature, exact message, and 2,592-byte public key with
 * empty context. Nonmatches are false; exceptions are Signature.VerificationFailed.
 *
 * @since 0.5.0
 * @category verification
 */
export const verify87 = dsa87.verify

/**
 * Generates an ML-DSA-87 key pair.
 * Requires Entropy.Entropy for a 32-byte seed. Returns a 2,592-byte public key
 * and 4,896-byte secret key; failures are KeyPair.GenerationFailed.
 *
 * @since 0.5.0
 * @category keys
 */
export const generateKeyPair87 = dsa87.keygen
