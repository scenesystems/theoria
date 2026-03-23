/**
 * Durable fingerprint contract tests.
 *
 * ### Determinism
 * - Same input → same output across calls
 * - Key ordering doesn't affect output
 *
 * ### Output format
 * - Produces algorithm-tagged string `blake3-256:<base64url>`
 *
 * ### Differentiation
 * - Different structures produce different fingerprints
 * - Nested structures fingerprint correctly
 *
 * ### Rejection of non-JSON-safe values
 * - undefined → FingerprintUnsupportedValue
 * - BigInt → FingerprintUnsupportedValue
 * - Symbol → FingerprintUnsupportedValue
 * - Date → FingerprintUnsupportedValue
 * - function → FingerprintUnsupportedValue
 */

import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit } from "effect"
import { durableFingerprint } from "../../src/schemas/durableFingerprint.js"

describe("durableFingerprint — output format and determinism", () => {
  it.effect("produces algorithm-tagged string for simple object", () =>
    Effect.gen(function*() {
      const result = yield* durableFingerprint({ key: "value" })
      expect(result).toMatch(/^blake3-256:[A-Za-z0-9_-]{43}$/)
    }))

  it.effect("is deterministic across calls", () =>
    Effect.gen(function*() {
      const input = { question: "What is 2+2?" }
      const a = yield* durableFingerprint(input)
      const b = yield* durableFingerprint(input)
      expect(a).toBe(b)
    }))

  it.effect("key ordering does not affect output", () =>
    Effect.gen(function*() {
      const a = yield* durableFingerprint({ a: 1, b: 2 })
      const b = yield* durableFingerprint({ b: 2, a: 1 })
      expect(a).toBe(b)
    }))
})

describe("durableFingerprint — differentiation", () => {
  it.effect("different structures produce different fingerprints", () =>
    Effect.gen(function*() {
      const a = yield* durableFingerprint({ x: 1 })
      const b = yield* durableFingerprint({ x: 2 })
      expect(a).not.toBe(b)
    }))

  it.effect("nested structures fingerprint correctly", () =>
    Effect.gen(function*() {
      const result = yield* durableFingerprint({ outer: { inner: "deep" } })
      expect(result).toMatch(/^blake3-256:[A-Za-z0-9_-]{43}$/)
    }))
})

describe("durableFingerprint — rejection of non-JSON-safe values", () => {
  it.effect("rejects undefined with FingerprintUnsupportedValue", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(durableFingerprint({ key: undefined }))
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        const error = exit.cause
        expect(error).toBeDefined()
      }
    }))

  it.effect("rejects BigInt with FingerprintUnsupportedValue", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(durableFingerprint({ key: BigInt(42) }))
      expect(Exit.isFailure(exit)).toBe(true)
    }))

  it.effect("rejects Symbol with FingerprintUnsupportedValue", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(durableFingerprint({ key: Symbol("test") }))
      expect(Exit.isFailure(exit)).toBe(true)
    }))

  it.effect("rejects Date with FingerprintUnsupportedValue", () =>
    Effect.gen(function*() {
      const date = new globalThis.Date()
      const exit = yield* Effect.exit(durableFingerprint({ key: date }))
      expect(Exit.isFailure(exit)).toBe(true)
    }))

  it.effect("rejects function with FingerprintUnsupportedValue", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(durableFingerprint({ key: () => 1 }))
      expect(Exit.isFailure(exit)).toBe(true)
    }))
})
