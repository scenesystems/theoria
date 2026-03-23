/**
 * Unified digest pipeline contract tests.
 *
 * ### Algorithm-tagged output
 * - BLAKE3 produces `blake3-256:<base64url>`
 * - SHA-256 produces `sha256:<base64url>`
 *
 * ### Pipeline composition
 * - Manual canonicalize → hash → encode matches pipeline
 * - Deterministic output
 * - Different algorithms diverge
 *
 * ### Structural handling
 * - Nested objects
 * - Arrays
 * - Null values
 */

import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { blake3Hash } from "../src/algorithms/blake3.js"
import { canonicalize } from "../src/canonicalize.js"
import { digest } from "../src/digest.js"
import { toBase64Url } from "../src/encoding.js"
import { utf8ToBytes } from "../src/internal/bytes.js"

describe("digest — algorithm-tagged output", () => {
  it.effect("BLAKE3 digest produces 'blake3-256:<base64url>' format", () =>
    Effect.gen(function*() {
      const result = yield* digest("blake3-256", { key: "value" })
      expect(result).toMatch(/^blake3-256:[A-Za-z0-9_-]{43}$/)
    }))

  it.effect("SHA-256 digest produces 'sha256:<base64url>' format", () =>
    Effect.gen(function*() {
      const result = yield* digest("sha256", { key: "value" })
      expect(result).toMatch(/^sha256:[A-Za-z0-9_-]{43}$/)
    }))
})

describe("digest — pipeline composition", () => {
  it.effect("is deterministic — same input produces same output", () =>
    Effect.gen(function*() {
      const input = { question: "What is 2+2?", answer: 4 }
      const a = yield* digest("blake3-256", input)
      const b = yield* digest("blake3-256", input)
      expect(a).toBe(b)
    }))

  it.effect("manual composition matches pipeline output", () =>
    Effect.gen(function*() {
      const input = { key: "value" }
      const canonical = yield* canonicalize(input)
      const bytes = utf8ToBytes(canonical)
      const hash = yield* blake3Hash(bytes)
      const encoded = yield* toBase64Url(hash)
      const manual = `blake3-256:${encoded}`
      const pipeline = yield* digest("blake3-256", input)
      expect(pipeline).toBe(manual)
    }))

  it.effect("different algorithms produce different output for same input", () =>
    Effect.gen(function*() {
      const input = { data: "test" }
      const b3 = yield* digest("blake3-256", input)
      const sha = yield* digest("sha256", input)
      expect(b3).not.toBe(sha)
    }))
})

describe("digest — structural handling", () => {
  it.effect("handles nested structures", () =>
    Effect.gen(function*() {
      const result = yield* digest("blake3-256", { a: { b: { c: 1 } } })
      expect(result).toMatch(/^blake3-256:[A-Za-z0-9_-]{43}$/)
    }))

  it.effect("handles arrays", () =>
    Effect.gen(function*() {
      const result = yield* digest("blake3-256", { items: [1, 2, 3] })
      expect(result).toMatch(/^blake3-256:[A-Za-z0-9_-]{43}$/)
    }))

  it.effect("handles null values", () =>
    Effect.gen(function*() {
      const result = yield* digest("blake3-256", { value: null })
      expect(result).toMatch(/^blake3-256:[A-Za-z0-9_-]{43}$/)
    }))
})
