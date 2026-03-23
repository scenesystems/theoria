/**
 * HKDF key derivation function contract tests.
 *
 * ### RFC 5869 vector correctness
 * - Case 1: basic SHA-256 (IKM=22 bytes, salt=13 bytes, info=10 bytes, L=42)
 * - Case 2: longer inputs (IKM=80, salt=80, info=80, L=82)
 * - Case 3: zero-length salt and info (L=42)
 *
 * ### Behavioral contracts
 * - Output length matches requested dkLen exactly
 * - Different info strings produce different derived keys (domain separation)
 * - Absent salt uses hash-length zero bytes per RFC 5869
 * - Deterministic — same inputs always produce same output
 */

import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { hkdfSha256 } from "../src/kdf.js"
import { expectByteLength, expectDigest } from "./helpers/assertions.js"
import { hkdfSha256Vectors } from "./helpers/vectors/hkdf.vectors.js"

describe("hkdfSha256 — RFC 5869 vectors", () => {
  it.effect("case 1 — basic test case (L=42)", () =>
    Effect.gen(function*() {
      const { ikm, salt, info, length, okm } = hkdfSha256Vectors.case1
      const result = yield* hkdfSha256(ikm, salt, info, length)
      expectDigest(result, okm)
    }))

  it.effect("case 2 — longer inputs (L=82)", () =>
    Effect.gen(function*() {
      const { ikm, salt, info, length, okm } = hkdfSha256Vectors.case2
      const result = yield* hkdfSha256(ikm, salt, info, length)
      expectDigest(result, okm)
    }))

  it.effect("case 3 — zero-length salt and info (L=42)", () =>
    Effect.gen(function*() {
      const { ikm, salt, info, length, okm } = hkdfSha256Vectors.case3
      const result = yield* hkdfSha256(ikm, salt, info, length)
      expectDigest(result, okm)
    }))
})

describe("hkdfSha256 — behavioral contracts", () => {
  it.effect("output length matches requested dkLen exactly", () =>
    Effect.gen(function*() {
      const { ikm, salt, info } = hkdfSha256Vectors.case1
      const r16 = yield* hkdfSha256(ikm, salt, info, 16)
      const r32 = yield* hkdfSha256(ikm, salt, info, 32)
      const r64 = yield* hkdfSha256(ikm, salt, info, 64)
      expectByteLength(r16, 16)
      expectByteLength(r32, 32)
      expectByteLength(r64, 64)
    }))

  it.effect("different info strings produce different derived keys", () =>
    Effect.gen(function*() {
      const { ikm, salt } = hkdfSha256Vectors.case1
      const infoA = new TextEncoder().encode("context-a")
      const infoB = new TextEncoder().encode("context-b")
      const a = yield* hkdfSha256(ikm, salt, infoA, 32)
      const b = yield* hkdfSha256(ikm, salt, infoB, 32)
      expect(a).not.toEqual(b)
    }))

  it.effect("absent salt matches zero-bytes salt per RFC", () =>
    Effect.gen(function*() {
      const { ikm, info, length, okm } = hkdfSha256Vectors.case3
      const result = yield* hkdfSha256(ikm, undefined, info, length)
      expectDigest(result, okm)
    }))

  it.effect("is deterministic — same inputs produce same output", () =>
    Effect.gen(function*() {
      const { ikm, salt, info, length } = hkdfSha256Vectors.case1
      const a = yield* hkdfSha256(ikm, salt, info, length)
      const b = yield* hkdfSha256(ikm, salt, info, length)
      expect(a).toEqual(b)
    }))
})
