/**
 * Streaming digest contract tests.
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
  DigestStreaming,
  DigestStreamingLive,
  digestUtf8,
  digestUtf8Base64Url,
  digestUtf8Stream,
  digestUtf8StreamBase64Url,
  digestUtf8StreamHex,
  toHex
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

  it.effect("re-running the same digest effect yields stable output", () =>
    Effect.gen(function*() {
      const chunks = [utf8ToBytes("reuse-"), utf8ToBytes("safe")]
      const program = digestByteStreamBase64Url("sha256", Stream.fromIterable(chunks))

      const first = yield* program
      const second = yield* program

      expect(second).toBe(first)
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

  it.effect("matches one-shot digestUtf8 when a surrogate pair is split across chunks", () =>
    Effect.gen(function*() {
      const chunks = ["scene-\uD83D", "\uDE00-systems"]
      const streamed = yield* digestUtf8Stream("blake3-256", Stream.fromIterable(chunks))
      const oneShot = yield* digestUtf8("blake3-256", "scene-\uD83D\uDE00-systems")
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

  it.effect("digestUtf8StreamBase64Url matches digestUtf8Base64Url", () =>
    Effect.gen(function*() {
      const chunks = ["stream", "ing", "-utf8-b64"]
      const streamed = yield* digestUtf8StreamBase64Url("sha256", Stream.fromIterable(chunks))
      const oneShot = yield* digestUtf8Base64Url("sha256", chunks.join(""))
      expect(streamed).toBe(oneShot)
      expect(streamed).toMatch(/^[A-Za-z0-9_-]{43}$/)
    }))

  it.effect("digestUtf8StreamHex matches byte-stream hex for equivalent payload", () =>
    Effect.gen(function*() {
      const chunks = ["stream", "ing", "-utf8-hex"]
      const streamed = yield* digestUtf8StreamHex("blake3-256", Stream.fromIterable(chunks))
      const asBytes = chunks.map(utf8ToBytes)
      const byteStream = yield* digestByteStreamHex("blake3-256", Stream.fromIterable(asBytes))
      expect(streamed).toBe(byteStream)
      expect(streamed).toMatch(/^[0-9a-f]{64}$/)
    }))
})

describe("stream failure propagation", () => {
  it.effect("digestByteStream preserves upstream stream errors", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(digestByteStream("sha256", Stream.fail("stream failed")))
      expect(result).toMatchObject({ _tag: "Left", left: "stream failed" })
    }))

  it.effect("digestUtf8Stream preserves upstream stream errors", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(digestUtf8Stream("blake3-256", Stream.fail("stream failed")))
      expect(result).toMatchObject({ _tag: "Left", left: "stream failed" })
    }))

  it.effect("digestByteStreamBase64Url preserves upstream stream errors", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(
        digestByteStreamBase64Url("sha256", Stream.fail("stream failed"))
      )
      expect(result).toMatchObject({ _tag: "Left", left: "stream failed" })
    }))

  it.effect("digestByteStreamHex preserves upstream stream errors", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(digestByteStreamHex("blake3-256", Stream.fail("stream failed")))
      expect(result).toMatchObject({ _tag: "Left", left: "stream failed" })
    }))
})

describe("DigestStreaming service", () => {
  it.effect("DigestStreamingLive provides injectable stream helpers", () =>
    Effect.gen(function*() {
      const digestStreaming = yield* DigestStreaming
      const chunks = [utf8ToBytes("inject-"), utf8ToBytes("able")]
      const textChunks = ["inject-", "text"]

      const streamed = yield* digestStreaming.digestByteStreamBase64Url(
        "blake3-256",
        Stream.fromIterable(chunks)
      )
      const oneShot = yield* digestBytesBase64Url("blake3-256", concatBytes(chunks))
      const streamedTextHex = yield* digestStreaming.digestUtf8StreamHex("sha256", Stream.fromIterable(textChunks))
      const oneShotText = yield* digestUtf8("sha256", textChunks.join(""))
      const oneShotTextHex = toHex(oneShotText)

      expect(streamed).toBe(oneShot)
      expect(streamedTextHex).toBe(oneShotTextHex)
    }).pipe(Effect.provide(DigestStreamingLive)))
})
