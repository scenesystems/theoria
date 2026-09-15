/**
 * Implements deterministic pure-Ed25519 signing and strict RFC 8032
 * verification with 32-byte keys and 64-byte signatures.
 *
 * @since 0.1.0
 * @category algorithms
 * @module
 */
import { ed25519 } from "@noble/curves/ed25519.js"
import { Array as Arr, Boolean as B, Effect, identity, Number as N, Schema } from "effect"
import { equalBytes } from "../encoding.js"
import { generateEntropy } from "../entropy.js"
import { copyBytes, detachVerificationInputs } from "../internal/verificationInput.js"
import {
  InvalidEd25519Seed,
  InvalidVerificationInput,
  KeyGenerationFailed,
  SigningFailed,
  VerificationUnavailable
} from "../schemas/errors.js"
import { KeyPair } from "../schemas/KeyPair.js"
import { Signature } from "../schemas/Signature.js"

/**
 * The exact 32-byte RFC 8032 secret seed, not an expanded 64-byte secret key.
 * Decoding validates the size; reconstruction also snapshots caller-owned bytes.
 *
 * @since 0.4.0
 * @category schemas
 */
export const Ed25519Seed = Schema.Uint8ArrayFromSelf.pipe(
  Schema.filter((bytes) => N.Equivalence(bytes.length, 32)),
  Schema.brand("Ed25519Seed")
)

/**
 * Reconstructs an Ed25519 identity from an existing 32-byte seed without entropy.
 * Inputs are admitted when executed. Both returned arrays are independently
 * owned by the caller; errors never retain seed or backend diagnostic material.
 *
 * @example
 * ```ts
 * import { ed25519KeyPairFromSeed } from "@scenesystems/sign"
 * import { Effect, Encoding } from "effect"
 * const identity = Effect.gen(function* () {
 *   const seed = yield* Encoding.decodeHex("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60")
 *   return yield* ed25519KeyPairFromSeed(seed)
 * })
 * ```
 *
 * @since 0.4.0
 * @category keys
 */
export const ed25519KeyPairFromSeed = (
  seed: Uint8Array
): Effect.Effect<KeyPair, InvalidEd25519Seed | KeyGenerationFailed> =>
  Effect.try({
    try: () => Schema.decodeUnknownEither(Ed25519Seed)(seed),
    catch: () => new InvalidEd25519Seed({})
  }).pipe(
    Effect.flatMap(identity),
    Effect.flatMap(copyBytes),
    Effect.mapError(() => new InvalidEd25519Seed({})),
    Effect.flatMap((secretKey) =>
      Effect.try({
        try: () => new KeyPair({ algorithm: "ed25519", secretKey, publicKey: ed25519.getPublicKey(secretKey) }),
        catch: () => new KeyGenerationFailed({ algorithm: "ed25519", reason: "Ed25519 derivation unavailable" })
      })
    )
  )

/**
 * Produces a deterministic 64-byte pure-Ed25519 signature over the exact message
 * bytes. The supplied public key must match the 32-byte secret seed. Keys and
 * message are copied when executed; malformed or mismatched keys fail closed.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const ed25519Sign = (
  message: Uint8Array,
  secretKey: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<Signature, SigningFailed> =>
  Effect.gen(function*() {
    const suppliedPublicKey = yield* copyBytes(publicKey)
    const keys = yield* ed25519KeyPairFromSeed(secretKey).pipe(
      Effect.filterOrFail(
        (pair) => equalBytes(pair.publicKey, suppliedPublicKey),
        () => new InvalidVerificationInput({})
      )
    )
    const protectedMessage = yield* copyBytes(message)
    return yield* Effect.try({
      try: () =>
        new Signature({
          algorithm: "ed25519",
          signature: ed25519.sign(protectedMessage, keys.secretKey),
          publicKey: keys.publicKey
        }),
      catch: () => new SigningFailed({ algorithm: "ed25519", reason: "Ed25519 signing unavailable" })
    })
  }).pipe(
    Effect.mapError(() => new SigningFailed({ algorithm: "ed25519", reason: "Invalid Ed25519 signing input" }))
  )

/**
 * Verifies a detached pure-Ed25519 signature using the strict RFC 8032 profile.
 *
 * @remarks
 * Both encoded points must be canonical and non-small-order, `S` must be less
 * than the subgroup order, and Noble's ZIP-215 mode is explicitly disabled.
 * Malformed input fails with `InvalidVerificationInput`; a canonical signature
 * that does not match returns `false`.
 *
 * Inputs are copied when the Effect executes and messages longer than 8,192
 * bytes are rejected. `VerificationUnavailable` means admitted input reached a
 * backend that could not execute; both failure types retain no input material.
 *
 * @param signature - Exactly 64 detached Ed25519 signature bytes.
 * @param message - Protected message bytes, at most 8,192 bytes.
 * @param publicKey - Exactly 32 canonical Ed25519 public-key bytes.
 * @returns `true` for a match, `false` for an admitted nonmatch, or a redacted
 * typed failure for invalid input or backend unavailability.
 * @see https://www.rfc-editor.org/rfc/rfc8032
 *
 * @since 0.1.0
 * @category algorithms
 */
export const ed25519Verify = (
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<boolean, InvalidVerificationInput | VerificationUnavailable> => {
  const detached = detachVerificationInputs(signature, message, publicKey)
  return detached.pipe(
    Effect.filterOrFail(
      (input) => B.and(N.Equivalence(input.signature.length, 64), N.Equivalence(input.publicKey.length, 32)),
      () => new InvalidVerificationInput({})
    ),
    Effect.flatMap((input) =>
      Effect.gen(function*() {
        yield* Effect.try({
          try: () => ed25519.Point.fromBytes(input.publicKey, false),
          catch: () => new InvalidVerificationInput({})
        }).pipe(Effect.filterOrFail((point) => B.not(point.isSmallOrder()), () => new InvalidVerificationInput({})))

        const signaturePoint = yield* Schema.decode(Schema.Uint8Array)(Arr.take(Arr.fromIterable(input.signature), 32))
          .pipe(
            Effect.mapError(() => new InvalidVerificationInput({}))
          )
        yield* Effect.try({
          try: () => ed25519.Point.fromBytes(signaturePoint, false),
          catch: () => new InvalidVerificationInput({})
        }).pipe(Effect.filterOrFail((point) => B.not(point.isSmallOrder()), () => new InvalidVerificationInput({})))

        const scalar = yield* Schema.decode(Schema.Uint8Array)(Arr.drop(Arr.fromIterable(input.signature), 32)).pipe(
          Effect.mapError(() => new InvalidVerificationInput({}))
        )
        yield* Effect.try({
          try: () => ed25519.Point.Fn.fromBytes(scalar),
          catch: () => new InvalidVerificationInput({})
        })

        return yield* Effect.try({
          try: () => ed25519.verify(input.signature, input.message, input.publicKey, { zip215: false }),
          catch: () => new VerificationUnavailable({})
        })
      })
    )
  )
}

/**
 * Draws an Ed25519 key pair through the package's entropy API, returning a 32-byte
 * secret seed and its 32-byte compressed Edwards public key. Fails with
 * `KeyGenerationFailed` when the runtime CSPRNG is unavailable.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const ed25519Keygen = (): Effect.Effect<KeyPair, KeyGenerationFailed> =>
  generateEntropy(32).pipe(
    Effect.flatMap(ed25519KeyPairFromSeed),
    Effect.mapError(() =>
      new KeyGenerationFailed({ algorithm: "ed25519", reason: "Ed25519 key generation unavailable" })
    )
  )
