/**
 * BLAKE3 multi-mode algorithm contract tests.
 *
 * ### Default hash mode (`blake3Hash`)
 * - Deterministic output for identical inputs
 * - 32-byte Uint8Array output shape
 * - Known test vector correctness (BLAKE3 reference)
 * - Empty input handling
 * - UTF-8 encoding consistency
 *
 * ### Keyed MAC mode (`blake3Mac`)
 * - 32-byte key requirement enforced (rejects shorter/longer keys)
 * - Different keys produce different MACs for same message
 * - Same key + same message is deterministic
 * - Output is 32 bytes regardless of message length
 *
 * ### Derive key mode (`blake3DeriveKey`)
 * - Context string provides domain separation
 * - Deterministic: same context + same input = same output
 * - Custom dkLen via Option.some produces exact length
 * - Default dkLen is 32 bytes
 * - Empty input produces valid derived key
 */

import { describe, expect, it } from "@effect/vitest"
import { utf8ToBytes } from "@noble/hashes/utils.js"
import { Effect, Exit, Option } from "effect"
import { blake3DeriveKey, blake3Hash, blake3Mac } from "../../src/algorithms/blake3.js"
import { InvalidKeyLength } from "../../src/schemas/errors.js"
import { expectByteLength, expectDigest } from "../helpers/assertions.js"
import { contexts, deriveVectors, hashVectors, macVectors } from "../helpers/vectors/blake3.vectors.js"

describe("blake3Hash — default hash mode", () => {
  it.effect("produces correct hash for empty input", () =>
    Effect.gen(function*() {
      const result = yield* blake3Hash(new Uint8Array(0))
      expectDigest(result, hashVectors.empty)
    }))

  it.effect("produces correct hash for 'hello'", () =>
    Effect.gen(function*() {
      const result = yield* blake3Hash(utf8ToBytes("hello"))
      expectDigest(result, hashVectors.hello)
    }))

  it.effect("produces correct hash for 'abc'", () =>
    Effect.gen(function*() {
      const result = yield* blake3Hash(utf8ToBytes("abc"))
      expectDigest(result, hashVectors.abc)
    }))

  it.effect("handles UTF-8 multibyte characters", () =>
    Effect.gen(function*() {
      const result = yield* blake3Hash(utf8ToBytes("hello 🌍"))
      expectDigest(result, hashVectors.utf8Emoji)
    }))

  it.effect("output is always 32 bytes", () =>
    Effect.gen(function*() {
      const a = yield* blake3Hash(new Uint8Array(0))
      const b = yield* blake3Hash(utf8ToBytes("hello"))
      const c = yield* blake3Hash(utf8ToBytes("a".repeat(10000)))
      expectByteLength(a, 32)
      expectByteLength(b, 32)
      expectByteLength(c, 32)
    }))

  it.effect("is deterministic — identical inputs produce identical output", () =>
    Effect.gen(function*() {
      const input = utf8ToBytes("determinism check")
      const a = yield* blake3Hash(input)
      const b = yield* blake3Hash(input)
      expect(a).toEqual(b)
    }))
})

describe("blake3Mac — keyed MAC mode", () => {
  const zerosKey = new Uint8Array(32)
  const onesKey = new Uint8Array(32).fill(1)

  it.effect("produces correct MAC with zeros key", () =>
    Effect.gen(function*() {
      const result = yield* blake3Mac(zerosKey, utf8ToBytes("hello"))
      expectDigest(result, macVectors.zerosKeyHello)
    }))

  it.effect("different keys produce different MACs for same message", () =>
    Effect.gen(function*() {
      const macA = yield* blake3Mac(zerosKey, utf8ToBytes("hello"))
      const macB = yield* blake3Mac(onesKey, utf8ToBytes("hello"))
      expectDigest(macA, macVectors.zerosKeyHello)
      expectDigest(macB, macVectors.onesKeyHello)
      expect(macA).not.toEqual(macB)
    }))

  it.effect("is deterministic — same key + same message = same MAC", () =>
    Effect.gen(function*() {
      const a = yield* blake3Mac(zerosKey, utf8ToBytes("hello"))
      const b = yield* blake3Mac(zerosKey, utf8ToBytes("hello"))
      expect(a).toEqual(b)
    }))

  it.effect("output is always 32 bytes regardless of message length", () =>
    Effect.gen(function*() {
      const a = yield* blake3Mac(zerosKey, new Uint8Array(0))
      const b = yield* blake3Mac(zerosKey, utf8ToBytes("hello"))
      const c = yield* blake3Mac(zerosKey, utf8ToBytes("a".repeat(1000)))
      expectByteLength(a, 32)
      expectByteLength(b, 32)
      expectByteLength(c, 32)
    }))

  it.effect("handles empty message", () =>
    Effect.gen(function*() {
      const result = yield* blake3Mac(zerosKey, new Uint8Array(0))
      expectDigest(result, macVectors.zerosKeyEmpty)
    }))

  it.effect("handles long message", () =>
    Effect.gen(function*() {
      const result = yield* blake3Mac(zerosKey, utf8ToBytes("a".repeat(1000)))
      expectDigest(result, macVectors.zerosKeyLong)
    }))

  it.effect("rejects key shorter than 32 bytes with InvalidKeyLength", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(blake3Mac(new Uint8Array(16), utf8ToBytes("hello")))
      expect(exit).toStrictEqual(
        Exit.fail(new InvalidKeyLength({ expected: 32, actual: 16 }))
      )
    }))

  it.effect("rejects key longer than 32 bytes with InvalidKeyLength", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(blake3Mac(new Uint8Array(64), utf8ToBytes("hello")))
      expect(exit).toStrictEqual(
        Exit.fail(new InvalidKeyLength({ expected: 32, actual: 64 }))
      )
    }))
})

describe("blake3DeriveKey — derive key mode", () => {
  it.effect("produces correct derived key for context + input", () =>
    Effect.gen(function*() {
      const result = yield* blake3DeriveKey(contexts.ctx1, utf8ToBytes("hello"))
      expectDigest(result, deriveVectors.ctx1Hello)
    }))

  it.effect("different contexts produce different derived keys for same input", () =>
    Effect.gen(function*() {
      const a = yield* blake3DeriveKey(contexts.ctx1, utf8ToBytes("hello"))
      const b = yield* blake3DeriveKey(contexts.ctx2, utf8ToBytes("hello"))
      expectDigest(a, deriveVectors.ctx1Hello)
      expectDigest(b, deriveVectors.ctx2Hello)
      expect(a).not.toEqual(b)
    }))

  it.effect("is deterministic — same context + same input = same output", () =>
    Effect.gen(function*() {
      const a = yield* blake3DeriveKey(contexts.ctx1, utf8ToBytes("hello"))
      const b = yield* blake3DeriveKey(contexts.ctx1, utf8ToBytes("hello"))
      expect(a).toEqual(b)
    }))

  it.effect("default output is 32 bytes", () =>
    Effect.gen(function*() {
      const result = yield* blake3DeriveKey(contexts.ctx1, utf8ToBytes("hello"))
      expectByteLength(result, 32)
    }))

  it.effect("Option.some(dkLen) produces output of exactly that length", () =>
    Effect.gen(function*() {
      const result = yield* blake3DeriveKey(
        contexts.ctx1,
        utf8ToBytes("hello"),
        Option.some(64)
      )
      expectByteLength(result, 64)
      expectDigest(result, deriveVectors.ctx1HelloDk64)
    }))

  it.effect("empty input produces valid derived key", () =>
    Effect.gen(function*() {
      const result = yield* blake3DeriveKey(contexts.ctx1, new Uint8Array(0))
      expectDigest(result, deriveVectors.ctx1Empty)
      expectByteLength(result, 32)
    }))
})
