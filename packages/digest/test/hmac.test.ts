/**
 * HMAC message authentication code contract tests.
 *
 * ### HMAC-SHA256 (RFC 4231)
 * - Test cases 1–4 golden vector correctness
 * - 32-byte output shape
 * - Deterministic — same key + message = same MAC
 * - Key independence — different keys produce different MACs
 * - Message independence — different messages produce different MACs
 * - Empty message handling
 * - Short key handling (below block size, padded internally)
 * - Long key handling (above block size, hashed internally)
 *
 * ### HMAC-SHA1 (RFC 2202, legacy)
 * - Test cases 1–2 golden vector correctness
 * - 20-byte output shape
 */

import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { hmacSha1, hmacSha256 } from "../src/hmac.js"
import { expectByteLength, expectDigest } from "./helpers/assertions.js"
import { hmacSha1Vectors, hmacSha256Vectors } from "./helpers/vectors/hmac.vectors.js"

describe("hmacSha256 — RFC 4231 vectors", () => {
  it.effect("case 1 — 20×0x0b key, 'Hi There'", () =>
    Effect.gen(function*() {
      const { key, data, expected } = hmacSha256Vectors.case1
      const result = yield* hmacSha256(key, data)
      expectDigest(result, expected)
    }))

  it.effect("case 2 — 'Jefe' key, 'what do ya want for nothing?'", () =>
    Effect.gen(function*() {
      const { key, data, expected } = hmacSha256Vectors.case2
      const result = yield* hmacSha256(key, data)
      expectDigest(result, expected)
    }))

  it.effect("case 3 — 20×0xaa key, 50×0xdd data", () =>
    Effect.gen(function*() {
      const { key, data, expected } = hmacSha256Vectors.case3
      const result = yield* hmacSha256(key, data)
      expectDigest(result, expected)
    }))

  it.effect("case 4 — 25-byte sequential key, 50×0xcd data", () =>
    Effect.gen(function*() {
      const { key, data, expected } = hmacSha256Vectors.case4
      const result = yield* hmacSha256(key, data)
      expectDigest(result, expected)
    }))
})

describe("hmacSha256 — behavioral contracts", () => {
  it.effect("output is always 32 bytes", () =>
    Effect.gen(function*() {
      const { key, data } = hmacSha256Vectors.case1
      const result = yield* hmacSha256(key, data)
      expectByteLength(result, 32)
    }))

  it.effect("is deterministic — same key + same message = same MAC", () =>
    Effect.gen(function*() {
      const { key, data } = hmacSha256Vectors.case1
      const a = yield* hmacSha256(key, data)
      const b = yield* hmacSha256(key, data)
      expect(a).toEqual(b)
    }))

  it.effect("different keys produce different MACs for same message", () =>
    Effect.gen(function*() {
      const message = hmacSha256Vectors.case1.data
      const a = yield* hmacSha256(hmacSha256Vectors.case1.key, message)
      const b = yield* hmacSha256(hmacSha256Vectors.case3.key, message)
      expect(a).not.toEqual(b)
    }))

  it.effect("different messages produce different MACs for same key", () =>
    Effect.gen(function*() {
      const key = hmacSha256Vectors.case1.key
      const a = yield* hmacSha256(key, hmacSha256Vectors.case1.data)
      const b = yield* hmacSha256(key, hmacSha256Vectors.case2.data)
      expect(a).not.toEqual(b)
    }))

  it.effect("empty message produces valid 32-byte MAC", () =>
    Effect.gen(function*() {
      const result = yield* hmacSha256(new Uint8Array(32), new Uint8Array(0))
      expectByteLength(result, 32)
    }))

  it.effect("short key works — padded internally per RFC 2104", () =>
    Effect.gen(function*() {
      const shortKey = new Uint8Array(4).fill(0x0b)
      const result = yield* hmacSha256(shortKey, new TextEncoder().encode("test"))
      expectByteLength(result, 32)
    }))

  it.effect("long key works — hashed internally per RFC 2104", () =>
    Effect.gen(function*() {
      const longKey = new Uint8Array(128).fill(0xaa)
      const result = yield* hmacSha256(longKey, new TextEncoder().encode("test"))
      expectByteLength(result, 32)
    }))
})

describe("hmacSha1 — RFC 2202 vectors (legacy)", () => {
  it.effect("case 1 — 20×0x0b key, 'Hi There'", () =>
    Effect.gen(function*() {
      const { key, data, expected } = hmacSha1Vectors.case1
      const result = yield* hmacSha1(key, data)
      expectDigest(result, expected)
    }))

  it.effect("case 2 — 'Jefe' key, 'what do ya want for nothing?'", () =>
    Effect.gen(function*() {
      const { key, data, expected } = hmacSha1Vectors.case2
      const result = yield* hmacSha1(key, data)
      expectDigest(result, expected)
    }))

  it.effect("output is always 20 bytes", () =>
    Effect.gen(function*() {
      const { key, data } = hmacSha1Vectors.case1
      const result = yield* hmacSha1(key, data)
      expectByteLength(result, 20)
    }))
})
