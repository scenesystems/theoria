/**
 * Canonical JSON helper contract tests.
 *
 * Target-state TDD: these tests define the desired one-call structured-value
 * digest API that eliminates repeated canonicalize + digest boilerplate.
 */

import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit } from "effect"
import {
  canonicalize,
  digestBytes,
  digestBytesBase64Url,
  digestBytesHex,
  digestCanonicalJsonBase64Url,
  digestCanonicalJsonBytes,
  digestCanonicalJsonHex,
  FingerprintUnsupportedValue,
  utf8ToBytes
} from "../src/index.js"

describe("digestCanonicalJsonBytes", () => {
  it.effect("matches canonicalize -> utf8ToBytes -> digestBytes for BLAKE3", () =>
    Effect.gen(function*() {
      const value = { b: 2, a: 1 }
      const canonical = yield* canonicalize(value)
      const manual = yield* digestBytes("blake3-256", utf8ToBytes(canonical))
      const helper = yield* digestCanonicalJsonBytes("blake3-256", value)
      expect(helper).toEqual(manual)
    }))

  it.effect("matches canonicalize -> utf8ToBytes -> digestBytes for SHA-256", () =>
    Effect.gen(function*() {
      const value = { id: "a-1", nested: { k: "v" } }
      const canonical = yield* canonicalize(value)
      const manual = yield* digestBytes("sha256", utf8ToBytes(canonical))
      const helper = yield* digestCanonicalJsonBytes("sha256", value)
      expect(helper).toEqual(manual)
    }))

  it.effect("is deterministic and invariant to object key order", () =>
    Effect.gen(function*() {
      const a = yield* digestCanonicalJsonBytes("blake3-256", { alpha: 1, beta: 2 })
      const b = yield* digestCanonicalJsonBytes("blake3-256", { beta: 2, alpha: 1 })
      expect(a).toEqual(b)
    }))

  it.effect("propagates FingerprintUnsupportedValue for non-JSON-safe input", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(digestCanonicalJsonBytes("sha256", { key: undefined }))
      expect(exit).toStrictEqual(
        Exit.fail(
          new FingerprintUnsupportedValue({
            valueType: "undefined",
            reason: "undefined is not representable in JSON"
          })
        )
      )
    }))
})

describe("digestCanonicalJsonBase64Url", () => {
  it.effect("matches canonicalize -> utf8ToBytes -> digestBytesBase64Url", () =>
    Effect.gen(function*() {
      const value = { prompt: "hello", version: 1 }
      const canonical = yield* canonicalize(value)
      const manual = yield* digestBytesBase64Url("blake3-256", utf8ToBytes(canonical))
      const helper = yield* digestCanonicalJsonBase64Url("blake3-256", value)
      expect(helper).toBe(manual)
      expect(helper).toMatch(/^[A-Za-z0-9_-]{43}$/)
    }))
})

describe("digestCanonicalJsonHex", () => {
  it.effect("matches canonicalize -> utf8ToBytes -> digestBytesHex", () =>
    Effect.gen(function*() {
      const value = { prompt: "hello", version: 1 }
      const canonical = yield* canonicalize(value)
      const manual = yield* digestBytesHex("sha256", utf8ToBytes(canonical))
      const helper = yield* digestCanonicalJsonHex("sha256", value)
      expect(helper).toBe(manual)
      expect(helper).toMatch(/^[0-9a-f]{64}$/)
    }))
})
