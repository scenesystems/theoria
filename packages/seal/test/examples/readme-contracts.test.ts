import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { generateKey, seal, unseal, utf8FromBytes, utf8ToBytes } from "../../src/index.js"

const roundTripExample = Effect.gen(function*() {
  const key = yield* generateKey(32)
  const plaintext = utf8ToBytes("hello, encryption!")
  const envelope = yield* seal("xchacha20-poly1305", key, plaintext)
  const recovered = yield* unseal(key, envelope)

  return {
    algorithm: envelope.algorithm,
    text: utf8FromBytes(recovered)
  }
})

const algorithms: ReadonlyArray<"xchacha20-poly1305" | "aes-256-gcm-siv" | "aes-256-gcm"> = [
  "xchacha20-poly1305",
  "aes-256-gcm-siv",
  "aes-256-gcm"
]

const algorithmComparisonExample = Effect.gen(function*() {
  const key = yield* generateKey(32)
  const plaintext = utf8ToBytes("same message, three algorithms")

  return yield* Effect.forEach(
    algorithms,
    (algorithm) =>
      Effect.gen(function*() {
        const envelope = yield* seal(algorithm, key, plaintext)
        const recovered = yield* unseal(key, envelope)

        return {
          algorithm,
          roundTrip: utf8FromBytes(recovered) === "same message, three algorithms"
        }
      }),
    { concurrency: 1 }
  )
})

const aadExample = Effect.gen(function*() {
  const key = yield* generateKey(32)
  const associatedData = utf8ToBytes("workflow-comparison:baseline:v1")
  const plaintext = utf8ToBytes("bind this ciphertext to protocol context")
  const envelope = yield* seal("xchacha20-poly1305", key, plaintext, {}, associatedData)
  const recovered = yield* unseal(key, envelope, associatedData)

  return {
    aadBytes: associatedData.byteLength,
    algorithm: envelope.algorithm,
    text: utf8FromBytes(recovered)
  }
})

describe("examples/readme-contracts", () => {
  it.effect("keeps the round-trip example runnable", () =>
    Effect.gen(function*() {
      const result = yield* roundTripExample

      expect(result.algorithm).toBe("xchacha20-poly1305")
      expect(result.text).toBe("hello, encryption!")
    }))

  it.effect("keeps the algorithm-comparison example runnable", () =>
    Effect.gen(function*() {
      const results = yield* algorithmComparisonExample

      expect(results).toHaveLength(3)
      expect(results.map(({ algorithm }) => algorithm)).toEqual(algorithms)
      expect(results.map(({ roundTrip }) => roundTrip)).toEqual([true, true, true])
    }))

  it.effect("keeps the associated-data example runnable", () =>
    Effect.gen(function*() {
      const result = yield* aadExample

      expect(result.algorithm).toBe("xchacha20-poly1305")
      expect(result.aadBytes).toBeGreaterThan(0)
      expect(result.text).toBe("bind this ciphertext to protocol context")
    }))
})
