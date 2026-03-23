/**
 * Convenience digest function contract tests.
 *
 * Target-state TDD — these imports SHOULD exist once implemented.
 * Tests specify the M347 north-star API surface.
 *
 * ### digestBytes(algorithm, bytes) — raw byte hashing
 * - BLAKE3-256 golden vector correctness
 * - SHA-256 golden vector correctness
 * - Algorithm parameterization — different algorithms diverge
 * - 32-byte Uint8Array output
 *
 * ### digestUtf8(algorithm, text) — string hashing
 * - BLAKE3-256 golden vector correctness
 * - SHA-256 golden vector correctness
 * - Empty string handling
 * - Equivalent to manual utf8ToBytes → digestBytes
 *
 * ### digestBytesBase64Url(algorithm, bytes) — hash + base64url
 * - BLAKE3-256 golden vector correctness
 * - SHA-256 golden vector correctness
 * - 43-char output for 256-bit digest
 * - URL-safe alphabet only
 *
 * ### digestUtf8Base64Url(algorithm, text) — hash string + base64url
 * - BLAKE3-256 golden vector correctness
 * - SHA-256 golden vector correctness
 * - Equivalent to digestBytesBase64Url(algo, utf8ToBytes(text))
 *
 * ### digestBytesHex(algorithm, bytes) — hash + hex
 * - BLAKE3-256 golden vector correctness
 * - SHA-256 golden vector correctness
 * - 64-char lowercase hex output
 *
 * ### canonicalJsonBytes(value) — canonicalize to UTF-8 bytes
 * - Produces Uint8Array from structured value
 * - Matches manual canonicalize → utf8ToBytes pipeline
 * - Rejects non-JSON-safe values with FingerprintUnsupportedValue
 * - Deterministic output
 */

import { describe, expect, it } from "@effect/vitest"
import { utf8ToBytes } from "@noble/hashes/utils.js"
import { Effect, Exit } from "effect"
import {
  canonicalize,
  canonicalJsonBytes,
  digestBytes,
  digestBytesBase64Url,
  digestBytesHex,
  digestUtf8,
  digestUtf8Base64Url,
  FingerprintUnsupportedValue
} from "../src/index.js"
import { expectByteLength, expectDigest } from "./helpers/assertions.js"
import { hashVectors } from "./helpers/vectors/blake3.vectors.js"
import { digestBase64UrlVectors } from "./helpers/vectors/convenience.vectors.js"
import { sha256Vectors } from "./helpers/vectors/sha256.vectors.js"

// ---------------------------------------------------------------------------
// digestBytes
// ---------------------------------------------------------------------------
describe("digestBytes — algorithm-parameterized raw byte hashing", () => {
  it.effect("BLAKE3-256 produces correct hash for 'hello'", () =>
    Effect.gen(function*() {
      const result = yield* digestBytes("blake3-256", utf8ToBytes("hello"))
      expectDigest(result, hashVectors.hello)
    }))

  it.effect("SHA-256 produces correct hash for 'hello'", () =>
    Effect.gen(function*() {
      const result = yield* digestBytes("sha256", utf8ToBytes("hello"))
      expectDigest(result, sha256Vectors.hello)
    }))

  it.effect("different algorithms produce different output for same input", () =>
    Effect.gen(function*() {
      const input = utf8ToBytes("hello")
      const b3 = yield* digestBytes("blake3-256", input)
      const sha = yield* digestBytes("sha256", input)
      expect(b3).not.toEqual(sha)
    }))

  it.effect("output is always 32 bytes", () =>
    Effect.gen(function*() {
      const result = yield* digestBytes("blake3-256", utf8ToBytes("hello"))
      expectByteLength(result, 32)
    }))

  it.effect("empty input produces valid 32-byte hash", () =>
    Effect.gen(function*() {
      const result = yield* digestBytes("blake3-256", new Uint8Array(0))
      expectDigest(result, hashVectors.empty)
      expectByteLength(result, 32)
    }))
})

// ---------------------------------------------------------------------------
// digestUtf8
// ---------------------------------------------------------------------------
describe("digestUtf8 — algorithm-parameterized string hashing", () => {
  it.effect("BLAKE3-256 produces correct hash for 'abc'", () =>
    Effect.gen(function*() {
      const result = yield* digestUtf8("blake3-256", "abc")
      expectDigest(result, hashVectors.abc)
    }))

  it.effect("SHA-256 produces correct hash for 'abc'", () =>
    Effect.gen(function*() {
      const result = yield* digestUtf8("sha256", "abc")
      expectDigest(result, sha256Vectors.abc)
    }))

  it.effect("empty string produces valid hash", () =>
    Effect.gen(function*() {
      const result = yield* digestUtf8("blake3-256", "")
      expectDigest(result, hashVectors.empty)
    }))

  it.effect("equivalent to manual utf8ToBytes → digestBytes", () =>
    Effect.gen(function*() {
      const fromUtf8 = yield* digestUtf8("sha256", "hello")
      const fromBytes = yield* digestBytes("sha256", utf8ToBytes("hello"))
      expect(fromUtf8).toEqual(fromBytes)
    }))
})

// ---------------------------------------------------------------------------
// digestBytesBase64Url
// ---------------------------------------------------------------------------
describe("digestBytesBase64Url — hash + base64url encode", () => {
  it.effect("BLAKE3-256 produces correct base64url for 'hello'", () =>
    Effect.gen(function*() {
      const result = yield* digestBytesBase64Url("blake3-256", utf8ToBytes("hello"))
      expect(result).toBe(digestBase64UrlVectors.blake3.hello)
    }))

  it.effect("SHA-256 produces correct base64url for 'hello'", () =>
    Effect.gen(function*() {
      const result = yield* digestBytesBase64Url("sha256", utf8ToBytes("hello"))
      expect(result).toBe(digestBase64UrlVectors.sha256.hello)
    }))

  it.effect("output is exactly 43 characters for 256-bit digest", () =>
    Effect.gen(function*() {
      const result = yield* digestBytesBase64Url("blake3-256", utf8ToBytes("hello"))
      expect(result.length).toBe(43)
    }))

  it.effect("URL-safe alphabet only — no + / =", () =>
    Effect.gen(function*() {
      const result = yield* digestBytesBase64Url("sha256", utf8ToBytes("test"))
      expect(result).not.toContain("+")
      expect(result).not.toContain("/")
      expect(result).not.toContain("=")
    }))
})

// ---------------------------------------------------------------------------
// digestUtf8Base64Url
// ---------------------------------------------------------------------------
describe("digestUtf8Base64Url — hash string + base64url encode", () => {
  it.effect("BLAKE3-256 produces correct base64url for 'hello'", () =>
    Effect.gen(function*() {
      const result = yield* digestUtf8Base64Url("blake3-256", "hello")
      expect(result).toBe(digestBase64UrlVectors.blake3.hello)
    }))

  it.effect("SHA-256 produces correct base64url for 'abc'", () =>
    Effect.gen(function*() {
      const result = yield* digestUtf8Base64Url("sha256", "abc")
      expect(result).toBe(digestBase64UrlVectors.sha256.abc)
    }))

  it.effect("equivalent to digestBytesBase64Url with utf8ToBytes", () =>
    Effect.gen(function*() {
      const fromUtf8 = yield* digestUtf8Base64Url("sha256", "hello")
      const fromBytes = yield* digestBytesBase64Url("sha256", utf8ToBytes("hello"))
      expect(fromUtf8).toBe(fromBytes)
    }))
})

// ---------------------------------------------------------------------------
// digestBytesHex
// ---------------------------------------------------------------------------
describe("digestBytesHex — hash + hex encode", () => {
  it.effect("BLAKE3-256 produces correct hex for 'hello'", () =>
    Effect.gen(function*() {
      const result = yield* digestBytesHex("blake3-256", utf8ToBytes("hello"))
      expect(result).toBe(hashVectors.hello)
    }))

  it.effect("SHA-256 produces correct hex for 'hello'", () =>
    Effect.gen(function*() {
      const result = yield* digestBytesHex("sha256", utf8ToBytes("hello"))
      expect(result).toBe(sha256Vectors.hello)
    }))

  it.effect("output is exactly 64 characters of lowercase hex", () =>
    Effect.gen(function*() {
      const result = yield* digestBytesHex("blake3-256", utf8ToBytes("hello"))
      expect(result.length).toBe(64)
      expect(result).toMatch(/^[0-9a-f]{64}$/)
    }))
})

// ---------------------------------------------------------------------------
// canonicalJsonBytes
// ---------------------------------------------------------------------------
describe("canonicalJsonBytes — canonicalize to UTF-8 bytes", () => {
  it.effect("produces Uint8Array from structured value", () =>
    Effect.gen(function*() {
      const result = yield* canonicalJsonBytes({ key: "value" })
      expect(result).toBeInstanceOf(Uint8Array)
      expect(result.length).toBeGreaterThan(0)
    }))

  it.effect("matches manual canonicalize → utf8ToBytes pipeline", () =>
    Effect.gen(function*() {
      const value = { z: 1, a: 2 }
      const canonical = yield* canonicalize(value)
      const manualBytes = utf8ToBytes(canonical)
      const pipelineBytes = yield* canonicalJsonBytes(value)
      expect(pipelineBytes).toEqual(manualBytes)
    }))

  it.effect("is deterministic — same input produces same output", () =>
    Effect.gen(function*() {
      const input = { question: "What is 2+2?" }
      const a = yield* canonicalJsonBytes(input)
      const b = yield* canonicalJsonBytes(input)
      expect(a).toEqual(b)
    }))

  it.effect("key ordering does not affect output", () =>
    Effect.gen(function*() {
      const a = yield* canonicalJsonBytes({ a: 1, b: 2 })
      const b = yield* canonicalJsonBytes({ b: 2, a: 1 })
      expect(a).toEqual(b)
    }))

  it.effect("rejects undefined with FingerprintUnsupportedValue", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(canonicalJsonBytes({ key: undefined }))
      expect(exit).toStrictEqual(
        Exit.fail(
          new FingerprintUnsupportedValue({ valueType: "undefined", reason: "undefined is not representable in JSON" })
        )
      )
    }))
})
