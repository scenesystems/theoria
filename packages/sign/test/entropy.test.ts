import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { mlDsa65SignHedged, mlDsa65Verify } from "../src/algorithms/mlDsa.js"
import { equalBytes } from "../src/encoding.js"
import { generateEntropy, HEDGED_SIGNING_ENTROPY_BYTES } from "../src/entropy.js"
import { generateKeyPair } from "../src/keyPair.js"

describe("generateEntropy", () => {
  it.effect("produces fresh bytes of the hedged-signing length by default", () =>
    Effect.gen(function*() {
      const first = yield* generateEntropy()
      const second = yield* generateEntropy()
      expect(first.length).toBe(HEDGED_SIGNING_ENTROPY_BYTES)
      expect(second.length).toBe(HEDGED_SIGNING_ENTROPY_BYTES)
      expect(equalBytes(first, second)).toBe(false)
    }))

  it.effect("is accepted by mlDsa65SignHedged", () =>
    Effect.gen(function*() {
      const keys = yield* generateKeyPair("ml-dsa-65")
      const message = new Uint8Array([1, 2, 3])
      const context = new Uint8Array(0)
      const entropy = yield* generateEntropy()
      const signature = yield* mlDsa65SignHedged(message, keys.secretKey, keys.publicKey, context, entropy)
      expect(yield* mlDsa65Verify(signature.signature, message, keys.publicKey, context)).toBe(true)
    }))
})
