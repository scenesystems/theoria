/**
 * Streaming digest contract tests (F1 target-state TDD).
 *
 * These tests intentionally specify APIs that do not exist yet.
 * Red failure is expected until the streaming implementation lands.
 */

import { describe, expect, it } from "@effect/vitest"
import { utf8ToBytes } from "@noble/hashes/utils.js"
import { Array as Arr, Effect, Stream } from "effect"
import {
  digestBytes,
  digestBytesBase64Url,
  digestBytesHex,
  digestByteStream,
  digestByteStreamBase64Url,
  digestByteStreamHex,
  digestUtf8,
  digestUtf8Stream
} from "../src/index.js"

const concatBytes = (chunks: ReadonlyArray<Uint8Array>): Uint8Array =>
  Arr.reduce(chunks, new Uint8Array(0), (acc, chunk) => {
    const merged = new Uint8Array(acc.length + chunk.length)
    merged.set(acc)
    merged.set(chunk, acc.length)
    return merged
  })

describe("digestByteStream — chunked byte hashing", () => {
  it.effect("matches one-shot digestBytes for BLAKE3", () =>
    Effect.gen(function*() {
      const chunks = [utf8ToBytes("hello "), utf8ToBytes("streaming "), utf8ToBytes("digest")]
      const streamed = yield* digestByteStream("blake3-256", Stream.fromIterable(chunks))
      const oneShot = yield* digestBytes("blake3-256", concatBytes(chunks))
      expect(streamed).toEqual(oneShot)
    }))

  it.effect("matches one-shot digestBytes for SHA-256", () =>
    Effect.gen(function*() {
      const chunks = [utf8ToBytes("hello "), utf8ToBytes("streaming "), utf8ToBytes("digest")]
      const streamed = yield* digestByteStream("sha256", Stream.fromIterable(chunks))
      const oneShot = yield* digestBytes("sha256", concatBytes(chunks))
      expect(streamed).toEqual(oneShot)
    }))

  it.effect("empty stream matches empty-input digest", () =>
    Effect.gen(function*() {
      const streamed = yield* digestByteStream("blake3-256", Stream.fromIterable<Uint8Array>([]))
      const oneShot = yield* digestBytes("blake3-256", new Uint8Array(0))
      expect(streamed).toEqual(oneShot)
    }))

  it.effect("chunk boundaries do not change digest value", () =>
    Effect.gen(function*() {
      const whole = utf8ToBytes("boundary-invariant-payload")
      const splitA = [whole.slice(0, 8), whole.slice(8)]
      const splitB = [whole.slice(0, 1), whole.slice(1, 5), whole.slice(5, 13), whole.slice(13)]

      const a = yield* digestByteStream("sha256", Stream.fromIterable(splitA))
      const b = yield* digestByteStream("sha256", Stream.fromIterable(splitB))
      expect(a).toEqual(b)
    }))

  it.effect("chunk order affects digest value", () =>
    Effect.gen(function*() {
      const forward = [utf8ToBytes("A"), utf8ToBytes("B"), utf8ToBytes("C")]
      const reverse = [utf8ToBytes("C"), utf8ToBytes("B"), utf8ToBytes("A")]

      const a = yield* digestByteStream("blake3-256", Stream.fromIterable(forward))
      const b = yield* digestByteStream("blake3-256", Stream.fromIterable(reverse))
      expect(a).not.toEqual(b)
    }))
})

describe("digestUtf8Stream — chunked string hashing", () => {
  it.effect("matches one-shot digestUtf8", () =>
    Effect.gen(function*() {
      const chunks = ["scene", "systems", "-digest"]
      const streamed = yield* digestUtf8Stream("sha256", Stream.fromIterable(chunks))
      const oneShot = yield* digestUtf8("sha256", chunks.join(""))
      expect(streamed).toEqual(oneShot)
    }))
})

describe("digestByteStream encoded variants", () => {
  it.effect("digestByteStreamBase64Url matches digestBytesBase64Url", () =>
    Effect.gen(function*() {
      const chunks = [utf8ToBytes("stream"), utf8ToBytes("ing"), utf8ToBytes("-b64")]
      const streamed = yield* digestByteStreamBase64Url("blake3-256", Stream.fromIterable(chunks))
      const oneShot = yield* digestBytesBase64Url("blake3-256", concatBytes(chunks))
      expect(streamed).toBe(oneShot)
      expect(streamed).toMatch(/^[A-Za-z0-9_-]{43}$/)
    }))

  it.effect("digestByteStreamHex matches digestBytesHex", () =>
    Effect.gen(function*() {
      const chunks = [utf8ToBytes("stream"), utf8ToBytes("ing"), utf8ToBytes("-hex")]
      const streamed = yield* digestByteStreamHex("sha256", Stream.fromIterable(chunks))
      const oneShot = yield* digestBytesHex("sha256", concatBytes(chunks))
      expect(streamed).toBe(oneShot)
      expect(streamed).toMatch(/^[0-9a-f]{64}$/)
    }))
})
