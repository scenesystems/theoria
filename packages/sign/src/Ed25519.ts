/**
 * Pure Ed25519 signing, strict verification, and key generation.
 *
 * @since 0.5.0
 * @module
 */
import { ed25519 } from "@noble/curves/ed25519.js"
import { Array as Arr, Boolean as B, Effect, identity, Number as N, Schema } from "effect"
import * as Bytes from "./Bytes.js"
import * as Entropy from "./Entropy.js"
import { copyBytes, detachVerificationInputs } from "./internal/verificationInput.js"
import * as KeyPair from "./KeyPair.js"
import * as Signature from "./Signature.js"
import * as Verification from "./Verification.js"

/**
 * The exact 32-byte RFC 8032 secret seed.
 * Decoding validates size without copying. This is not an expanded 64-byte
 * secret key. Use keyPairFromSeed to validate and snapshot external seed bytes.
 *
 * @since 0.5.0
 * @category schemas
 */
export const Seed = Schema.Uint8ArrayFromSelf.pipe(
  Schema.filter((bytes) => N.Equivalence(bytes.length, 32)),
  Schema.brand("@scenesystems/sign/Ed25519/Seed"),
  Schema.annotations({
    identifier: "@scenesystems/sign/Ed25519/Seed",
    title: "Ed25519 seed",
    description: "An exact 32-byte RFC 8032 secret seed."
  })
)

/**
 * The branded Ed25519 seed type.
 *
 * @since 0.5.0
 * @category models
 */
export type Seed = typeof Seed.Type

/**
 * Ed25519 reconstruction requires exactly 32 seed bytes.
 * Retains neither rejected seed material nor backend diagnostics.
 *
 * @since 0.5.0
 * @category errors
 */
export class InvalidSeed extends Schema.TaggedError<InvalidSeed>("@scenesystems/sign/Ed25519/InvalidSeed")(
  "InvalidEd25519Seed",
  {},
  {
    title: "Invalid Ed25519 seed",
    description: "The supplied value is not an exact 32-byte Ed25519 seed."
  }
) {}

/**
 * Reconstructs an Ed25519 key pair from an existing seed without entropy.
 * Validates and snapshots inputs on execution. Returns independently owned
 * secret-seed and compressed public-key arrays, each 32 bytes. Invalid input is
 * InvalidSeed; backend failure is KeyPair.GenerationFailed with a fixed reason.
 *
 * @since 0.5.0
 * @category keys
 */
export const keyPairFromSeed = (
  seed: Uint8Array
): Effect.Effect<KeyPair.KeyPair, InvalidSeed | KeyPair.GenerationFailed> =>
  Effect.try({
    try: () => Schema.decodeUnknownEither(Seed)(seed),
    catch: () => new InvalidSeed({})
  }).pipe(
    Effect.flatMap(identity),
    Effect.flatMap(copyBytes),
    Effect.mapError(() => new InvalidSeed({})),
    Effect.flatMap((secretKey) =>
      Effect.try({
        try: () => new KeyPair.KeyPair({ algorithm: "ed25519", secretKey, publicKey: ed25519.getPublicKey(secretKey) }),
        catch: () => new KeyPair.GenerationFailed({ algorithm: "ed25519", reason: "Ed25519 derivation unavailable" })
      })
    )
  )

/**
 * Generates an Ed25519 key pair from explicit runtime entropy.
 * Requires Entropy.Entropy for a fresh 32-byte seed. Returns the seed and its
 * 32-byte compressed public key; failures become KeyPair.GenerationFailed.
 *
 * @since 0.5.0
 * @category keys
 */
export const generateKeyPair = (): Effect.Effect<KeyPair.KeyPair, KeyPair.GenerationFailed, Entropy.Entropy> =>
  Entropy.bytes(32).pipe(
    Effect.flatMap(keyPairFromSeed),
    Effect.mapError(() =>
      new KeyPair.GenerationFailed({ algorithm: "ed25519", reason: "Ed25519 key generation unavailable" })
    )
  )

/**
 * Produces a deterministic pure-Ed25519 signature.
 * Signs exact message bytes without framing or domain separation. The supplied
 * public key must match the 32-byte secret seed. All inputs are copied on
 * execution; malformed or mismatched keys fail with Signature.SigningFailed.
 * Returns a 64-byte signature and the derived public key. Requires no Entropy.
 *
 * @since 0.5.0
 * @category signing
 */
export const sign = (
  message: Uint8Array,
  secretKey: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<Signature.Signature, Signature.SigningFailed> =>
  Effect.gen(function*() {
    const suppliedPublicKey = yield* copyBytes(publicKey)
    const keys = yield* keyPairFromSeed(secretKey).pipe(
      Effect.filterOrFail(
        (pair) => Bytes.equal(pair.publicKey, suppliedPublicKey),
        () => new Verification.InvalidInput({})
      )
    )
    const protectedMessage = yield* copyBytes(message)
    return yield* Effect.try({
      try: () =>
        new Signature.Signature({
          algorithm: "ed25519",
          signature: ed25519.sign(protectedMessage, keys.secretKey),
          publicKey: keys.publicKey
        }),
      catch: () => new Signature.SigningFailed({ algorithm: "ed25519", reason: "Ed25519 signing unavailable" })
    })
  }).pipe(
    Effect.mapError(() =>
      new Signature.SigningFailed({ algorithm: "ed25519", reason: "Invalid Ed25519 signing input" })
    )
  )

/**
 * Verifies a detached pure-Ed25519 signature with strict RFC 8032 admission.
 * Requires a 32-byte public key, a 64-byte signature, and a message of at most
 * Verification.maxMessageBytes. Both encoded points must be canonical and
 * non-small-order, and S must be less than the subgroup order. ZIP-215 is disabled.
 *
 * Inputs are admitted and copied on each execution. A canonical nonmatch is
 * false; malformed input is Verification.InvalidInput; backend failure is
 * Verification.Unavailable. Both errors retain no material. The synchronous
 * primitive cannot be interrupted. Callers must authenticate the public key.
 * @see https://www.rfc-editor.org/rfc/rfc8032
 *
 * @since 0.5.0
 * @category verification
 */
export const verify = (
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<boolean, Verification.InvalidInput | Verification.Unavailable> =>
  detachVerificationInputs(signature, message, publicKey).pipe(
    Effect.filterOrFail(
      (input) => B.and(N.Equivalence(input.signature.length, 64), N.Equivalence(input.publicKey.length, 32)),
      () => new Verification.InvalidInput({})
    ),
    Effect.flatMap((input) =>
      Effect.gen(function*() {
        yield* Effect.try({
          try: () => ed25519.Point.fromBytes(input.publicKey, false),
          catch: () => new Verification.InvalidInput({})
        }).pipe(
          Effect.filterOrFail((point) => B.not(point.isSmallOrder()), () => new Verification.InvalidInput({}))
        )
        const signaturePoint = yield* Schema.decode(Schema.Uint8Array)(Arr.take(Arr.fromIterable(input.signature), 32))
          .pipe(Effect.mapError(() => new Verification.InvalidInput({})))
        yield* Effect.try({
          try: () => ed25519.Point.fromBytes(signaturePoint, false),
          catch: () => new Verification.InvalidInput({})
        }).pipe(
          Effect.filterOrFail((point) => B.not(point.isSmallOrder()), () => new Verification.InvalidInput({}))
        )
        const scalar = yield* Schema.decode(Schema.Uint8Array)(Arr.drop(Arr.fromIterable(input.signature), 32)).pipe(
          Effect.mapError(() => new Verification.InvalidInput({}))
        )
        yield* Effect.try({
          try: () => ed25519.Point.Fn.fromBytes(scalar),
          catch: () => new Verification.InvalidInput({})
        })
        return yield* Effect.try({
          try: () => ed25519.verify(input.signature, input.message, input.publicKey, { zip215: false }),
          catch: () => new Verification.Unavailable({})
        })
      })
    )
  )
