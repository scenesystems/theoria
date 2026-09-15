import { describe, expect, it } from "@effect/vitest"
import {
  ed25519Verify,
  InvalidVerificationInput,
  mlDsa65Keygen,
  mlDsa65SignHedged,
  mlDsa65Verify,
  p256Sha256P1363LowSVerify,
  SigningFailed,
  utf8ToBytes
} from "@scenesystems/sign"
import { Array as Arr, Effect, Encoding, Match, Schema, Tuple } from "effect"
import { Ed25519Fixture, P256Fixture } from "../../scripts/fixture-contract.js"
import ed25519Corpus from "../fixtures/conformance/ed25519.json" with { type: "json" }
import p256Corpus from "../fixtures/conformance/p256.json" with { type: "json" }

const copyBytes = (bytes: Uint8Array) =>
  Schema.encode(Schema.Uint8Array)(bytes).pipe(Effect.flatMap(Schema.decode(Schema.Uint8Array)))

/** Authorized test-only host operation: detach real storage, including an empty buffer. */
const detachedBytes = (bytes: Uint8Array) =>
  Effect.gen(function*() {
    const buffer = yield* Schema.decodeUnknown(Schema.instanceOf(ArrayBuffer))(bytes.buffer)
    yield* Effect.sync(() => buffer.transfer())
    return bytes
  })

/** Authorized test-only Proxy/Reflect boundary: length works, but typed-array iteration fails. */
const uncopyableBytes = (bytes: Uint8Array) =>
  Effect.sync(() =>
    new Proxy(bytes, {
      get: (target, property) =>
        Match.value(property).pipe(
          Match.when("length", () => target.length),
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
      const keys = yield* mlDsa65Keygen()
      const empty = utf8ToBytes("")
      const entropy = yield* Schema.decode(Schema.Uint8Array)(Arr.replicate(0x42, 32))
      const signed = yield* mlDsa65SignHedged(empty, keys.secretKey, keys.publicKey, empty, entropy)
      const verifyMlDsa = (signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array) =>
        mlDsa65Verify(signature, message, publicKey, empty)

      yield* Effect.forEach(
        Arr.make(
          Tuple.make(
            "Ed25519",
            ed25519Verify,
            yield* Encoding.decodeHex(ed25519.signature),
            yield* Encoding.decodeHex(ed25519.message),
            yield* Encoding.decodeHex(ed25519.publicKey)
          ),
          Tuple.make(
            "P-256",
            p256Sha256P1363LowSVerify,
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
                      expect(yield* Effect.flip(verification), name).toEqual(new InvalidVerificationInput({}))
                    })
                )
              }))

            const pendingMessage = yield* copyBytes(message)
            const pending = verify(signature, pendingMessage, publicKey)
            yield* detachedBytes(pendingMessage)
            expect(yield* Effect.flip(pending), name).toEqual(new InvalidVerificationInput({}))

            const atLimit = yield* Schema.decode(Schema.Uint8Array)(Arr.replicate(0, 8_192))
            const overLimit = yield* Schema.decode(Schema.Uint8Array)(Arr.replicate(0, 8_193))
            expect(yield* verify(signature, atLimit, publicKey), name).toBe(false)
            expect(yield* Effect.flip(verify(signature, overLimit, publicKey)), name)
              .toEqual(new InvalidVerificationInput({}))
          })
      )

      yield* Effect.forEach(Arr.make(detachedBytes, uncopyableBytes), (unreadable) =>
        Effect.gen(function*() {
          const context = yield* unreadable(yield* copyBytes(empty))
          expect(yield* Effect.flip(mlDsa65Verify(signed.signature, empty, keys.publicKey, context)))
            .toEqual(new InvalidVerificationInput({}))
        }))
      const pendingContext = yield* copyBytes(empty)
      const pending = mlDsa65Verify(signed.signature, empty, keys.publicKey, pendingContext)
      yield* detachedBytes(pendingContext)
      expect(yield* Effect.flip(pending)).toEqual(new InvalidVerificationInput({}))
    }))

  it.effect("hedged signing rejects each unreadable input without throwing or misclassifying it as a backend failure", () =>
    Effect.gen(function*() {
      const keys = yield* mlDsa65Keygen()
      const message = utf8ToBytes("")
      const context = utf8ToBytes("")
      const entropy = yield* Schema.decode(Schema.Uint8Array)(Arr.replicate(0x42, 32))
      const signed = yield* mlDsa65SignHedged(message, keys.secretKey, keys.publicKey, context, entropy)
      expect(yield* mlDsa65Verify(signed.signature, message, keys.publicKey, context)).toBe(true)

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
                const signing = mlDsa65SignHedged(msg, secretKey, publicKey, ctx, rnd)
                expect(yield* Effect.flip(signing))
                  .toEqual(new SigningFailed({ algorithm: "ml-dsa-65", reason: "invalid input" }))
              })
          )
        }))

      const pending = mlDsa65SignHedged(message, keys.secretKey, keys.publicKey, context, entropy)
      yield* detachedBytes(entropy)
      expect(yield* Effect.flip(pending))
        .toEqual(new SigningFailed({ algorithm: "ml-dsa-65", reason: "invalid input" }))
    }))
})
