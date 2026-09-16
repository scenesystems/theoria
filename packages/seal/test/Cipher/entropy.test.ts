import { describe, expect, it } from "@effect/vitest"
import { Cipher } from "@scenesystems/seal"
import { Array, Deferred, Effect, Encoding, Exit, Fiber, Number, Ref, Schema, String } from "effect"
import * as internal from "../../src/internal/cipher.js"
import { key, plaintext, vectors } from "../fixtures/vectors.js"

const unavailable = internal.make(() => Effect.fail(new internal.EntropyFailed()))

describe("Cipher entropy failures", () => {
  it.effect("reports key generation failure without a defect or backend diagnostics", () =>
    Effect.gen(function*() {
      expect(yield* Effect.exit(Cipher.generateKey)).toStrictEqual(Exit.fail(new Cipher.KeyGenerationFailed()))
    }).pipe(Effect.provideService(Cipher.Cipher, unavailable)))

  it.effect("validates keys before attempting entropy and reports failed nonce generation", () =>
    Effect.forEach(Cipher.Algorithm.literals, (algorithm) =>
      Effect.gen(function*() {
        expect(yield* Effect.exit(Cipher.encrypt(algorithm, key, plaintext)))
          .toStrictEqual(Exit.fail(new Cipher.EncryptionFailed({ algorithm })))
        const invalid = yield* Schema.decode(Schema.Uint8Array)(Array.replicate(0, 31))
        const recovered = yield* Cipher.encrypt(algorithm, invalid, plaintext).pipe(
          Effect.catchTag("InvalidKey", (error) => Effect.succeed(error.received))
        )
        expect(recovered).toBe(31)
      })).pipe(Effect.provideService(Cipher.Cipher, unavailable)))

  it.effect("does not need entropy to decrypt", () =>
    Effect.forEach(vectors, (vector) =>
      Effect.gen(function*() {
        const secret = yield* Encoding.decodeHex(vector.key)
        const raw = yield* Encoding.decodeHex(String.concat(vector.nonce, vector.ciphertext))
        expect(Encoding.encodeHex(yield* Cipher.decrypt(vector.algorithm, secret, raw))).toBe(vector.plaintext)
      })).pipe(Effect.provideService(Cipher.Cipher, unavailable)))

  it.effect("rejects generated material that violates key policy", () =>
    Effect.forEach([Array.replicate(0, 32), Array.replicate(5, 31)], (input) =>
      Effect.gen(function*() {
        const bytes = yield* Schema.decode(Schema.Uint8Array)(input)
        const result = yield* Effect.exit(Cipher.generateKey.pipe(
          Effect.provideService(Cipher.Cipher, internal.make(() => Effect.succeed(bytes)))
        ))
        expect(result).toStrictEqual(Exit.fail(new Cipher.KeyGenerationFailed()))
      })))

  it.effect("acquires entropy lazily on each execution, after key validation", () =>
    Effect.gen(function*() {
      const requests = yield* Ref.make(Array.empty<number>())
      const backend = internal.make((length) =>
        Ref.update(requests, Array.append(length)).pipe(
          Effect.as(Schema.decodeSync(Schema.Uint8Array)(Array.replicate(7, length)))
        )
      )
      const generate = Cipher.generateKey.pipe(Effect.provideService(Cipher.Cipher, backend))
      const encrypt = Cipher.encrypt("aes-256-gcm", key, plaintext).pipe(
        Effect.provideService(Cipher.Cipher, backend)
      )
      expect(yield* Ref.get(requests)).toEqual([])
      yield* generate
      yield* generate
      yield* encrypt
      yield* encrypt
      const zero = yield* Schema.decode(Schema.Uint8Array)(Array.replicate(0, 32))
      yield* Cipher.encrypt("aes-256-gcm", zero, plaintext).pipe(
        Effect.provideService(Cipher.Cipher, backend),
        Effect.exit
      )
      expect(yield* Ref.get(requests)).toEqual([32, 32, 12, 12])
    }))

  it.effect("rejects a nonce whose length differs from the algorithm's wire boundary", () =>
    Effect.forEach(Cipher.Algorithm.literals, (algorithm) =>
      Effect.gen(function*() {
        const backend = internal.make((length) =>
          Effect.succeed(Schema.decodeSync(Schema.Uint8Array)(Array.replicate(7, Number.increment(length))))
        )
        expect(
          yield* Cipher.encrypt(algorithm, key, plaintext).pipe(
            Effect.provideService(Cipher.Cipher, backend),
            Effect.exit
          )
        ).toStrictEqual(Exit.fail(new Cipher.EncryptionFailed({ algorithm })))
      })))

  it.effect("interrupts pending entropy acquisition and releases its scope without producing ciphertext", () =>
    Effect.gen(function*() {
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
        Effect.fork
      )
      yield* Deferred.await(started)
      expect(Exit.isInterrupted(yield* Fiber.interrupt(fiber))).toBe(true)
      expect(yield* Ref.get(released)).toBe(true)
    }))
})
