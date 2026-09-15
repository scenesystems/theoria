import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Data, Effect, Schema } from "effect"
import {
  EntropyGenerationFailed,
  equalBytes,
  generateEntropy,
  generateKeyPair,
  mlDsa65SignHedged,
  mlDsa65Verify
} from "../src/index.js"

describe("generateEntropy", () => {
  it.effect("produces fresh bytes of the hedged-signing length by default", () =>
    Effect.gen(function*() {
      const first = yield* generateEntropy()
      const second = yield* generateEntropy()
      expect(first.length).toBe(32)
      expect(second.length).toBe(32)
      expect(equalBytes(first, second)).toBe(false)
    }))

  it.effect("is accepted by mlDsa65SignHedged", () =>
    Effect.gen(function*() {
      const keys = yield* generateKeyPair("ml-dsa-65")
      const message = yield* Schema.decode(Schema.Uint8Array)(Arr.make(1, 2, 3))
      const context = yield* Schema.decode(Schema.Uint8Array)(Arr.empty())
      const entropy = yield* generateEntropy()
      const signature = yield* mlDsa65SignHedged(message, keys.secretKey, keys.publicKey, context, entropy)
      expect(yield* mlDsa65Verify(signature.signature, message, keys.publicKey, context)).toBe(true)
    }))

  it.effect("preserves the rejected length and source diagnostic in EntropyGenerationFailed", () =>
    Effect.forEach(
      Arr.make(
        Data.struct({ length: -1, reason: "RangeError: \"bytesLength\" expected integer >= 0, got -1" }),
        Data.struct({ length: 1.5, reason: "RangeError: \"bytesLength\" expected integer >= 0, got 1.5" }),
        Data.struct({ length: 65_537, reason: "RangeError: \"bytesLength\" expected <= 65536, got 65537" })
      ),
      ({ length, reason }) =>
        Effect.gen(function*() {
          const error = yield* Effect.flip(generateEntropy(length))
          expect(error).toBeInstanceOf(EntropyGenerationFailed)
          expect(error.length).toBe(length)
          expect(error.reason).toBe(reason)
        })
    ))
})
