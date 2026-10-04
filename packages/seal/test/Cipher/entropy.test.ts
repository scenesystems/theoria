import { describe, expect, it, vi } from "@effect/vitest"
import { Cipher } from "@scenesystems/seal"
import { Array, Cause, Deferred, Effect, Exit, Fiber, Number, Ref, Schema, String } from "effect"
import * as internal from "../../src/internal/cipher.js"
import { key as keyFixture, plaintext as plaintextFixture, vectors } from "../fixtures/vectors.js"

const bytes = Schema.decodeEffect(Schema.Uint8ArrayFromHex)
const unavailableEntropy = Effect.acquireRelease(
  Effect.sync(() => vi.stubGlobal("crypto", undefined)),
  () => Effect.sync(() => vi.unstubAllGlobals())
)

describe("Cipher entropy failures", { concurrent: false }, () => {
  it.effect("reports missing host key entropy as a typed failure", () =>
    Effect.gen(function*() {
      yield* unavailableEntropy
      expect(yield* Effect.exit(Cipher.generateKey)).toStrictEqual(Exit.fail(new Cipher.KeyGenerationFailed()))
    }).pipe(Effect.provide(Cipher.layer)))

  it.effect("validates keys before entropy and reports missing nonce entropy", () =>
    Effect.gen(function*() {
      yield* unavailableEntropy
      const key = yield* bytes(keyFixture)
      const plaintext = yield* bytes(plaintextFixture)
      yield* Effect.forEach(Cipher.Algorithm.literals, (algorithm) =>
        Effect.gen(function*() {
          expect(yield* Effect.exit(Cipher.encrypt(algorithm, key, plaintext)))
            .toStrictEqual(Exit.fail(new Cipher.EncryptionFailed({ algorithm })))
          const invalid = yield* bytes(String.repeat(31)("00"))
          expect(
            yield* Cipher.encrypt(algorithm, invalid, plaintext).pipe(
              Effect.catchTag("InvalidKey", (error) => Effect.succeed(error.received))
            )
          ).toBe(31)
        }))
    }).pipe(Effect.provide(Cipher.layer)))

  it.effect("decrypts published ciphertext without entropy", () =>
    Effect.gen(function*() {
      yield* unavailableEntropy
      yield* Effect.forEach(vectors, (vector) =>
        Effect.gen(function*() {
          const encrypted = new Cipher.Encrypted({
            algorithm: vector.algorithm,
            nonce: yield* bytes(vector.nonce),
            ciphertext: yield* bytes(vector.ciphertext)
          })
          const opened = yield* Cipher.decrypt(encrypted, yield* bytes(vector.key))
          expect(yield* Schema.encodeEffect(Schema.Uint8ArrayFromHex)(opened)).toBe(vector.plaintext)
        }))
    }).pipe(Effect.provide(Cipher.layer)))

  it.effect("rejects generated material violating key policy", () =>
    Effect.forEach(Array.make(String.repeat(32)("00"), String.repeat(31)("05")), (fixture) =>
      Effect.gen(function*() {
        const result = yield* Effect.exit(Cipher.generateKey.pipe(
          Effect.provideService(
            Cipher.Cipher,
            internal.make(() => bytes(fixture).pipe(Effect.mapError(() => new internal.EntropyFailed())))
          )
        ))
        expect(result).toStrictEqual(Exit.fail(new Cipher.KeyGenerationFailed()))
      })))

  it.effect("acquires fresh entropy lazily on every execution after key validation", () =>
    Effect.gen(function*() {
      const key = yield* bytes(keyFixture)
      const plaintext = yield* bytes(plaintextFixture)
      const requests = yield* Ref.make(Array.empty<number>())
      const backend = internal.make((length) =>
        Ref.update(requests, Array.append(length)).pipe(
          Effect.andThen(
            bytes(String.repeat(length)("07")).pipe(
              Effect.mapError(() => new internal.EntropyFailed())
            )
          )
        )
      )
      const generate = Cipher.generateKey.pipe(Effect.provideService(Cipher.Cipher, backend))
      const encrypt = Cipher.encrypt("aes-256-gcm", key, plaintext).pipe(Effect.provideService(Cipher.Cipher, backend))
      expect(yield* Ref.get(requests)).toEqual(Array.empty())
      const first = yield* generate
      const second = yield* generate
      expect(first).not.toBe(second)
      const firstEncrypted = yield* encrypt
      const secondEncrypted = yield* encrypt
      expect(firstEncrypted.nonce).not.toBe(secondEncrypted.nonce)
      yield* Cipher.encrypt("aes-256-gcm", yield* bytes(String.repeat(32)("00")), plaintext).pipe(
        Effect.provideService(Cipher.Cipher, backend),
        Effect.exit
      )
      expect(yield* Ref.get(requests)).toEqual(Array.make(32, 32, 12, 12))
    }))

  it.effect("rejects entropy with the wrong nonce length", () =>
    Effect.gen(function*() {
      const key = yield* bytes(keyFixture)
      const plaintext = yield* bytes(plaintextFixture)
      yield* Effect.forEach(Cipher.Algorithm.literals, (algorithm) =>
        Effect.gen(function*() {
          const backend = internal.make((length) =>
            bytes(String.repeat(Number.increment(length))("07")).pipe(
              Effect.mapError(() => new internal.EntropyFailed())
            )
          )
          expect(
            yield* Cipher.encrypt(algorithm, key, plaintext).pipe(
              Effect.provideService(Cipher.Cipher, backend),
              Effect.exit
            )
          ).toStrictEqual(Exit.fail(new Cipher.EncryptionFailed({ algorithm })))
        }))
    }))

  it.effect("interrupts pending entropy acquisition and releases its scope", () =>
    Effect.gen(function*() {
      const key = yield* bytes(keyFixture)
      const plaintext = yield* bytes(plaintextFixture)
      const started = yield* Deferred.make<void>()
      const released = yield* Ref.make(false)
      const backend = internal.make(() =>
        Effect.acquireUseRelease(
          Deferred.succeed(started, undefined),
          () => Effect.never,
          () => Ref.set(released, true)
        )
      )
      const fiber = yield* Cipher.encrypt("aes-256-gcm", key, plaintext).pipe(
        Effect.provideService(Cipher.Cipher, backend),
        Effect.forkChild
      )
      yield* Deferred.await(started)
      yield* Fiber.interrupt(fiber)
      expect(Exit.match(yield* Fiber.await(fiber), { onFailure: Cause.hasInterruptsOnly, onSuccess: () => false }))
        .toBe(true)
      expect(yield* Ref.get(released)).toBe(true)
    }))
})
