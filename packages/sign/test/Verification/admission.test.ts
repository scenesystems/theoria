import { describe, expect, it } from "@effect/vitest"
import { Bytes, Ed25519, Entropy, MlDsa, P256, Rsa, Signature, Verification } from "@scenesystems/sign"
import { Array as Arr, Boolean as B, Effect, Encoding, Match, Number as N, Schema, Tuple } from "effect"
import { Ed25519Fixture, P256Fixture, RsaWycheproofFixture } from "../../scripts/fixture-contract.js"
import ed25519Corpus from "../fixtures/conformance/ed25519.json" with { type: "json" }
import p256Corpus from "../fixtures/conformance/p256.json" with { type: "json" }
import rsaCorpus from "../fixtures/conformance/rsa-wycheproof.json" with { type: "json" }

const copyBytes = (bytes: Uint8Array) =>
  Schema.encode(Schema.Uint8Array)(bytes).pipe(Effect.flatMap(Schema.decode(Schema.Uint8Array)))

/** Test-only host operation: detach real storage, including an empty buffer. */
const detachedBytes = (bytes: Uint8Array) =>
  Effect.gen(function*() {
    const buffer = yield* Schema.decodeUnknown(Schema.instanceOf(ArrayBuffer))(bytes.buffer)
    yield* Effect.sync(() => buffer.transfer())
    return bytes
  })

/** Test-only Proxy/Reflect operation: reject copying, or optionally length admission itself. */
const uncopyableBytes = (bytes: Uint8Array, unreadableLength = false) =>
  Effect.sync(() =>
    new Proxy(bytes, {
      get: (target, property) =>
        Match.value(property).pipe(
          Match.when("length", () =>
            B.match(unreadableLength, {
              onTrue: () => Schema.decodeUnknownSync(Schema.Never)(target.length),
              onFalse: () => target.length
            })),
          Match.orElse(() => Reflect.get(target, property))
        )
    })
  )

describe("strict direct verification admission", () => {
  it.effect("rejects one unreadable input in otherwise genuine verification, including detachment after construction", () =>
    Effect.gen(function*() {
      const ed25519 = Arr.headNonEmpty(
        (yield* Schema.decodeUnknown(Schema.typeSchema(Ed25519Fixture))(ed25519Corpus)).cases
      )
      const p256 = Arr.headNonEmpty(
        (yield* Schema.decodeUnknown(Schema.typeSchema(P256Fixture))(p256Corpus)).cases
      )
      const keys = yield* MlDsa.generateKeyPair65()
      const empty = Bytes.fromString("")
      const entropy = yield* Schema.decode(Schema.Uint8Array)(Arr.replicate(0x42, MlDsa.entropyBytes))
      const signed = yield* MlDsa.sign65Hedged(empty, keys.secretKey, keys.publicKey, empty, entropy)
      const verifyMlDsa = (signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array) =>
        MlDsa.verify65(signature, message, publicKey, empty)

      yield* Effect.forEach(
        Arr.make(
          Tuple.make(
            "Ed25519",
            Ed25519.verify,
            yield* Encoding.decodeHex(ed25519.signature),
            yield* Encoding.decodeHex(ed25519.message),
            yield* Encoding.decodeHex(ed25519.publicKey)
          ),
          Tuple.make(
            "P-256",
            P256.verify,
            yield* Encoding.decodeHex(p256.signature),
            yield* Encoding.decodeHex(p256.message),
            yield* Encoding.decodeHex(p256.publicKey.uncompressed)
          ),
          Tuple.make("ML-DSA-65", verifyMlDsa, signed.signature, empty, keys.publicKey)
        ),
        ([name, verify, signature, message, publicKey]) =>
          Effect.gen(function*() {
            expect(yield* verify(signature, message, publicKey), name).toBe(true)
            yield* Effect.forEach(Arr.make(detachedBytes, uncopyableBytes), (unreadable) =>
              Effect.gen(function*() {
                yield* Effect.forEach(
                  Arr.make(
                    Tuple.make(yield* unreadable(yield* copyBytes(signature)), message, publicKey),
                    Tuple.make(signature, yield* unreadable(yield* copyBytes(message)), publicKey),
                    Tuple.make(signature, message, yield* unreadable(yield* copyBytes(publicKey)))
                  ),
                  ([sig, msg, key]) =>
                    Effect.gen(function*() {
                      // Calling the public API must not throw, even before its Effect runs.
                      const verification = verify(sig, msg, key)
                      expect(yield* Effect.flip(verification), name).toEqual(new Verification.InvalidInput({}))
                    })
                )
              }))

            const pendingMessage = yield* copyBytes(message)
            const pending = verify(signature, pendingMessage, publicKey)
            yield* detachedBytes(pendingMessage)
            expect(yield* Effect.flip(pending), name).toEqual(new Verification.InvalidInput({}))

            const atLimit = yield* Schema.decode(Schema.Uint8Array)(Arr.replicate(0, Verification.maxMessageBytes))
            const overLimit = yield* Schema.decode(Schema.Uint8Array)(
              Arr.replicate(0, N.increment(Verification.maxMessageBytes))
            )
            expect(yield* verify(signature, atLimit, publicKey), name).toBe(false)
            expect(yield* Effect.flip(verify(signature, overLimit, publicKey)), name)
              .toEqual(new Verification.InvalidInput({}))
          })
      )

      yield* Effect.forEach(Arr.make(detachedBytes, uncopyableBytes), (unreadable) =>
        Effect.gen(function*() {
          const context = yield* unreadable(yield* copyBytes(empty))
          expect(yield* Effect.flip(MlDsa.verify65(signed.signature, empty, keys.publicKey, context)))
            .toEqual(new Verification.InvalidInput({}))
        }))
      const pendingContext = yield* copyBytes(empty)
      const pending = MlDsa.verify65(signed.signature, empty, keys.publicKey, pendingContext)
      yield* detachedBytes(pendingContext)
      expect(yield* Effect.flip(pending)).toEqual(new Verification.InvalidInput({}))
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("rejects unreadable RSA verification bytes and Ed25519 reconstruction seeds as admission failures", () =>
    Effect.gen(function*() {
      const rsa = Arr.headNonEmpty(
        (yield* Schema.decodeUnknown(Schema.typeSchema(RsaWycheproofFixture))(rsaCorpus)).testGroups
      )
      const rsaKey = yield* Rsa.publicKeyFromJwk(rsa.keyJwk)
      const rsaSignature = yield* Schema.decode(Schema.Uint8Array)(Arr.replicate(0, 256))
      const message = Bytes.fromString("")
      const seed = yield* Encoding.decodeHex("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60")

      yield* Effect.forEach(
        Arr.make(detachedBytes, uncopyableBytes, (bytes: Uint8Array) => uncopyableBytes(bytes, true)),
        (unreadable) =>
          Effect.gen(function*() {
            expect(
              yield* Effect.flip(Rsa.verify(yield* unreadable(yield* copyBytes(rsaSignature)), message, rsaKey))
            ).toEqual(new Verification.InvalidInput({}))
            expect(
              yield* Effect.flip(Rsa.verify(rsaSignature, yield* unreadable(yield* copyBytes(message)), rsaKey))
            ).toEqual(new Verification.InvalidInput({}))
            expect(yield* Effect.flip(Ed25519.keyPairFromSeed(yield* unreadable(yield* copyBytes(seed)))))
              .toEqual(new Ed25519.InvalidSeed({}))
          })
      )

      const pendingSignature = yield* copyBytes(rsaSignature)
      const pendingVerification = Rsa.verify(pendingSignature, message, rsaKey)
      yield* detachedBytes(pendingSignature)
      expect(yield* Effect.flip(pendingVerification)).toEqual(new Verification.InvalidInput({}))

      const pendingSeed = yield* copyBytes(seed)
      const pendingReconstruction = Ed25519.keyPairFromSeed(pendingSeed)
      yield* detachedBytes(pendingSeed)
      expect(yield* Effect.flip(pendingReconstruction)).toEqual(new Ed25519.InvalidSeed({}))
    }))

  it.effect("hedged signing rejects each unreadable input without throwing or misclassifying it as a backend failure", () =>
    Effect.gen(function*() {
      const keys = yield* MlDsa.generateKeyPair65()
      const message = Bytes.fromString("")
      const context = Bytes.fromString("")
      const entropy = yield* Schema.decode(Schema.Uint8Array)(Arr.replicate(0x42, MlDsa.entropyBytes))
      const signed = yield* MlDsa.sign65Hedged(message, keys.secretKey, keys.publicKey, context, entropy)
      expect(yield* MlDsa.verify65(signed.signature, message, keys.publicKey, context)).toBe(true)

      yield* Effect.forEach(Arr.make(detachedBytes, uncopyableBytes), (unreadable) =>
        Effect.gen(function*() {
          yield* Effect.forEach(
            Arr.make(
              Tuple.make(
                yield* unreadable(yield* copyBytes(message)),
                keys.secretKey,
                keys.publicKey,
                context,
                entropy
              ),
              Tuple.make(
                message,
                yield* unreadable(yield* copyBytes(keys.secretKey)),
                keys.publicKey,
                context,
                entropy
              ),
              Tuple.make(
                message,
                keys.secretKey,
                yield* unreadable(yield* copyBytes(keys.publicKey)),
                context,
                entropy
              ),
              Tuple.make(
                message,
                keys.secretKey,
                keys.publicKey,
                yield* unreadable(yield* copyBytes(context)),
                entropy
              ),
              Tuple.make(message, keys.secretKey, keys.publicKey, context, yield* unreadable(yield* copyBytes(entropy)))
            ),
            ([msg, secretKey, publicKey, ctx, rnd]) =>
              Effect.gen(function*() {
                const signing = MlDsa.sign65Hedged(msg, secretKey, publicKey, ctx, rnd)
                expect(yield* Effect.flip(signing))
                  .toEqual(new Signature.SigningFailed({ algorithm: "ml-dsa-65", reason: "invalid input" }))
              })
          )
        }))

      const pending = MlDsa.sign65Hedged(message, keys.secretKey, keys.publicKey, context, entropy)
      yield* detachedBytes(entropy)
      expect(yield* Effect.flip(pending))
        .toEqual(new Signature.SigningFailed({ algorithm: "ml-dsa-65", reason: "invalid input" }))
    }).pipe(Effect.provide(Entropy.layer)))
})
