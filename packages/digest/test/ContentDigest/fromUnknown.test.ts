import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Exit } from "effect"

import * as CanonicalJson from "../../src/CanonicalJson.js"
import * as ContentDigest from "../../src/ContentDigest.js"

describe("ContentDigest.fromUnknown", () => {
  it.effect("matches the explicit canonical-byte pipeline", () =>
    Effect.gen(function*() {
      const value = { key: "value" }
      const bytes = yield* CanonicalJson.encodeBytes(value)
      const expected = ContentDigest.fromBytes("blake3-256", bytes)
      const actual = yield* ContentDigest.fromUnknown("blake3-256", value)

      expect(actual).toStrictEqual(expected)
      expect(ContentDigest.toString(actual)).toMatch(/^blake3-256:[A-Za-z0-9_-]{43}$/)
    }))

  it.effect("is deterministic and invariant to record insertion order", () =>
    Effect.gen(function*() {
      const first = yield* ContentDigest.fromUnknown("blake3-256", { a: 1, b: 2 })
      const second = yield* ContentDigest.fromUnknown("blake3-256", { b: 2, a: 1 })

      expect(second).toStrictEqual(first)
      expect(ContentDigest.toString(second)).toBe(ContentDigest.toString(first))
    }))

  it.effect("keeps the selected algorithm in the runtime model and wire string", () =>
    Effect.gen(function*() {
      const value = { items: Arr.make(1, 2, 3), nested: { enabled: true } }
      const blake3 = yield* ContentDigest.fromUnknown("blake3-256", value)
      const sha256 = yield* ContentDigest.fromUnknown("sha256", value)

      expect(blake3.algorithm).toBe("blake3-256")
      expect(sha256.algorithm).toBe("sha256")
      expect(ContentDigest.toString(blake3)).not.toBe(ContentDigest.toString(sha256))
    }))

  it.effect("preserves canonicalization failures", () =>
    Effect.gen(function*() {
      expect(yield* Effect.exit(ContentDigest.fromUnknown("sha256", { key: undefined }))).toStrictEqual(
        Exit.fail(new CanonicalJson.UnsupportedValue({ reason: "undefined" }))
      )
    }))
})
