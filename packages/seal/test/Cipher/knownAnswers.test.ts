import { describe, expect, it } from "@effect/vitest"
import * as Cipher from "@scenesystems/seal/Cipher"
import { Effect, Schema } from "effect"
import * as internal from "../../src/internal/cipher.js"
import { vectors } from "../fixtures/vectors.js"

const bytes = Schema.decodeEffect(Schema.Uint8ArrayFromHex)

describe.each(vectors)("Cipher known answer: $algorithm", (vector) => {
  it.effect("decrypts independently published ciphertext through the production layer", () =>
    Effect.gen(function*() {
      const key = yield* bytes(vector.key)
      const encrypted = new Cipher.Encrypted({
        algorithm: vector.algorithm,
        nonce: yield* bytes(vector.nonce),
        ciphertext: yield* bytes(vector.ciphertext)
      })
      expect(yield* Schema.encodeEffect(Schema.Uint8ArrayFromHex)(yield* Cipher.decrypt(encrypted, key)))
        .toBe(vector.plaintext)
    }).pipe(Effect.provide(Cipher.layer)))

  it.effect("encrypts to the exact published fields with private entropy", () =>
    Effect.gen(function*() {
      const key = yield* bytes(vector.key)
      const plaintext = yield* bytes(vector.plaintext)
      const backend = internal.make((length) =>
        Effect.gen(function*() {
          const nonce = yield* bytes(vector.nonce)
          expect(length).toBe(nonce.length)
          return nonce
        }).pipe(Effect.mapError(() => new internal.EntropyFailed()))
      )
      const encrypted = yield* Cipher.encrypt(vector.algorithm, key, plaintext).pipe(
        Effect.provideService(Cipher.Cipher, backend)
      )
      expect(yield* Schema.encodeEffect(Schema.Uint8ArrayFromHex)(encrypted.nonce)).toBe(vector.nonce)
      expect(yield* Schema.encodeEffect(Schema.Uint8ArrayFromHex)(encrypted.ciphertext)).toBe(vector.ciphertext)
    }))
})
