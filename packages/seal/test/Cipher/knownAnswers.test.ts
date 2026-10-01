import { describe, expect, it } from "@effect/vitest"
import * as Cipher from "@scenesystems/seal/Cipher"
import { Effect, Encoding, String } from "effect"
import * as internal from "../../src/internal/cipher.js"
import { vectors } from "../fixtures/vectors.js"

describe.each(vectors)("Cipher known answer: $algorithm", (vector) => {
  it.effect("decrypts independently published ciphertext through the production layer", () =>
    Effect.gen(function*() {
      const key = yield* Encoding.decodeHex(vector.key)
      const raw = yield* Encoding.decodeHex(String.concat(vector.nonce, vector.ciphertext))
      const expected = yield* Encoding.decodeHex(vector.plaintext)
      expect(yield* Cipher.decrypt(vector.algorithm, key, raw)).toEqual(expected)
    }).pipe(Effect.provide(Cipher.layer)))

  it.effect("encrypts to the exact published bytes with entropy controlled at the private adapter", () =>
    Effect.gen(function*() {
      const key = yield* Encoding.decodeHex(vector.key)
      const nonce = yield* Encoding.decodeHex(vector.nonce)
      const plaintext = yield* Encoding.decodeHex(vector.plaintext)
      const backend = internal.make((length) =>
        Effect.sync(() => {
          expect(length).toBe(nonce.length)
          return nonce
        })
      )
      const encrypted = yield* Cipher.encrypt(vector.algorithm, key, plaintext).pipe(
        Effect.provideService(Cipher.Cipher, backend)
      )
      expect(Encoding.encodeHex(encrypted)).toBe(String.concat(vector.nonce, vector.ciphertext))
    }))
})
