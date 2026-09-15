import { describe, expect, it } from "@effect/vitest"
import { Cipher } from "@scenesystems/seal"
import { Effect, Encoding, Exit, Schema } from "effect"
import * as internal from "../../src/internal/cipher.js"
import { key, plaintext, vectors } from "../fixtures/vectors.js"

// The adapter boundary throws like a failed host CSPRNG, without touching a host global.
const unavailable = internal.make(() => Schema.decodeUnknownSync(Schema.Never)("CSPRNG unavailable"))

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
        const recovered = yield* Cipher.encrypt(algorithm, new Uint8Array(31), plaintext).pipe(
          Effect.catchTag("InvalidKey", (error) => Effect.succeed(error.received))
        )
        expect(recovered).toBe(31)
      })).pipe(Effect.provideService(Cipher.Cipher, unavailable)))

  it.effect("does not need entropy to decrypt", () =>
    Effect.forEach(vectors, (vector) =>
      Effect.gen(function*() {
        const secret = yield* Encoding.decodeHex(vector.key)
        const raw = yield* Encoding.decodeHex(vector.nonce + vector.ciphertext)
        expect(Encoding.encodeHex(yield* Cipher.decrypt(vector.algorithm, secret, raw))).toBe(vector.plaintext)
      })).pipe(Effect.provideService(Cipher.Cipher, unavailable)))

  it.effect("rejects generated material that violates key policy", () =>
    Effect.forEach([new Uint8Array(32), new Uint8Array(31).fill(5)], (bytes) =>
      Effect.gen(function*() {
        const result = yield* Effect.exit(Cipher.generateKey.pipe(
          Effect.provideService(Cipher.Cipher, internal.make(() => bytes))
        ))
        expect(result).toStrictEqual(Exit.fail(new Cipher.KeyGenerationFailed()))
      })))
})
