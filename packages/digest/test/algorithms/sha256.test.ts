/**
 * SHA-256 algorithm contract tests.
 *
 * ### NIST FIPS 180-4 vector correctness
 * - Empty string vector
 * - One-block "abc" vector
 * - Two-block 448-bit message vector
 *
 * ### Behavioral contracts
 * - 32-byte Uint8Array output shape for all inputs
 * - Deterministic — identical inputs produce identical output
 * - UTF-8 multibyte character handling
 * - Diverges from BLAKE3 for same input
 */

import { describe, expect, it } from "@effect/vitest"
import { utf8ToBytes } from "@noble/hashes/utils.js"
import { Effect } from "effect"
import { blake3Hash } from "../../src/algorithms/blake3.js"
import { sha256 } from "../../src/algorithms/sha256.js"
import { expectByteLength, expectDigest } from "../helpers/assertions.js"
import { sha256Vectors } from "../helpers/vectors/sha256.vectors.js"

describe("sha256 — NIST FIPS 180-4 vectors", () => {
  it.effect("produces correct hash for empty input", () =>
    Effect.gen(function*() {
      const result = yield* sha256(new Uint8Array(0))
      expectDigest(result, sha256Vectors.empty)
    }))

  it.effect("produces correct hash for 'abc'", () =>
    Effect.gen(function*() {
      const result = yield* sha256(utf8ToBytes("abc"))
      expectDigest(result, sha256Vectors.abc)
    }))

  it.effect("produces correct hash for 'hello'", () =>
    Effect.gen(function*() {
      const result = yield* sha256(utf8ToBytes("hello"))
      expectDigest(result, sha256Vectors.hello)
    }))

  it.effect("produces correct hash for two-block 448-bit message", () =>
    Effect.gen(function*() {
      const input = utf8ToBytes("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")
      const result = yield* sha256(input)
      expectDigest(result, sha256Vectors.twoBlock)
    }))

  it.effect("handles UTF-8 multibyte characters", () =>
    Effect.gen(function*() {
      const result = yield* sha256(utf8ToBytes("hello 🌍"))
      expectDigest(result, sha256Vectors.utf8Emoji)
    }))
})

describe("sha256 — output shape", () => {
  it.effect("output is always 32 bytes", () =>
    Effect.gen(function*() {
      const a = yield* sha256(new Uint8Array(0))
      const b = yield* sha256(utf8ToBytes("hello"))
      const c = yield* sha256(utf8ToBytes("a".repeat(10000)))
      expectByteLength(a, 32)
      expectByteLength(b, 32)
      expectByteLength(c, 32)
    }))

  it.effect("is deterministic — identical inputs produce identical output", () =>
    Effect.gen(function*() {
      const input = utf8ToBytes("determinism check")
      const a = yield* sha256(input)
      const b = yield* sha256(input)
      expect(a).toEqual(b)
    }))

  it.effect("diverges from BLAKE3 for same input", () =>
    Effect.gen(function*() {
      const input = utf8ToBytes("hello")
      const s = yield* sha256(input)
      const b = yield* blake3Hash(input)
      expect(s).not.toEqual(b)
    }))
})
