/**
 * Streaming digest contract tests.
 */

import { describe, expect, it } from "@effect/vitest"
import { utf8ToBytes } from "@noble/hashes/utils.js"
import { Array as Arr, Effect, Exit, FastCheck as fc, Stream } from "effect"
import {
  digestBytes,
  digestBytesBase64Url,
  digestBytesHex,
  digestByteStream,
  digestByteStreamBase64Url,
  digestByteStreamHex,
  digestUtf8,
  digestUtf8Base64Url,
  digestUtf8Stream,
  digestUtf8StreamBase64Url,
  digestUtf8StreamHex,
  InvalidUnicode
} from "../src/index.js"

const concatBytes = (chunks: ReadonlyArray<Uint8Array>): Uint8Array =>
  Arr.reduce(chunks, new Uint8Array(0), (acc, chunk) => {
    const merged = new Uint8Array(acc.length + chunk.length)
    merged.set(acc)
    merged.set(chunk, acc.length)
    return merged
  })

const partitionAt = (text: string, cuts: ReadonlyArray<number>): ReadonlyArray<string> => {
  const boundaries = Arr.append(Arr.prepend(cuts, 0), text.length)
  return Arr.map(
    Arr.zip(Arr.dropRight(boundaries, 1), Arr.drop(boundaries, 1)),
    ([start, end]) => text.slice(start, end)
  )
}

const everyPartition = (text: string): ReadonlyArray<ReadonlyArray<string>> =>
  Arr.map(
    Arr.makeBy(2 ** Math.max(0, text.length - 1), (mask) => mask),
    (mask) =>
      partitionAt(
        text,
        Arr.filter(
          Arr.makeBy(Math.max(0, text.length - 1), (index) => index + 1),
          (boundary) => (mask & (1 << (boundary - 1))) !== 0
        )
      )
  )

const randomPartition = (text: string, splitAfter: ReadonlyArray<boolean>): ReadonlyArray<string> =>
  partitionAt(
    text,
    Arr.filter(
      Arr.makeBy(Math.max(0, text.length - 1), (index) => index + 1),
      (boundary) => splitAfter[boundary - 1] === true
    )
  )

const wellFormedString = fc.fullUnicodeString({ maxLength: 64 })
const randomChunkBoundaries = fc.array(fc.boolean(), { maxLength: 64 })

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
  it.effect("accepts a pair split at every chunk boundary", () =>
    Effect.gen(function*() {
      const text = "A😀B"
      const oneShot = yield* digestUtf8("sha256", text)

      yield* Effect.forEach(everyPartition(text), (chunks) =>
        Effect.gen(function*() {
          const streamed = yield* digestUtf8Stream("sha256", Stream.fromIterable(chunks))
          expect(streamed).toEqual(oneShot)
        }))
    }))

  it.effect("rejects a leading low surrogate", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(
        digestUtf8Stream("blake3-256", Stream.fromIterable(["ab", "\uDC00c"]))
      )

      expect(exit).toStrictEqual(Exit.fail(
        new InvalidUnicode({
          kind: "lone-low-surrogate",
          codeUnitIndex: 2
        })
      ))
    }))

  it.effect("rejects a mismatched carried pair", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(
        digestUtf8Stream("sha256", Stream.fromIterable(["ab\uD800", "\uD801c"]))
      )

      expect(exit).toStrictEqual(Exit.fail(
        new InvalidUnicode({
          kind: "lone-high-surrogate",
          codeUnitIndex: 2
        })
      ))
    }))

  it.effect("fails an unresolved final carry", () =>
    Effect.gen(function*() {
      const chunks = Stream.fromIterable(["ab", "\uD800"])
      const expected = Exit.fail(
        new InvalidUnicode({
          kind: "lone-high-surrogate",
          codeUnitIndex: 2
        })
      )
      const bytesExit = yield* Effect.exit(digestUtf8Stream("blake3-256", chunks))
      const base64UrlExit = yield* Effect.exit(digestUtf8StreamBase64Url("blake3-256", chunks))
      const hexExit = yield* Effect.exit(digestUtf8StreamHex("blake3-256", chunks))

      expect(bytesExit).toStrictEqual(expected)
      expect(base64UrlExit).toStrictEqual(expected)
      expect(hexExit).toStrictEqual(expected)
    }))

  it.effect("preserves upstream failures", () =>
    Effect.gen(function*() {
      const chunks = Stream.concat(Stream.make("valid"), Stream.fail("stream failed"))
      const result = yield* Effect.either(digestUtf8Stream("blake3-256", chunks))

      expect(result).toMatchObject({ _tag: "Left", left: "stream failed" })
    }))

  it.effect.prop(
    "well-formed output is partition invariant",
    [wellFormedString, randomChunkBoundaries],
    ([text, splitAfter]) =>
      Effect.gen(function*() {
        const streamed = yield* digestUtf8Stream(
          "sha256",
          Stream.fromIterable(randomPartition(text, splitAfter))
        )
        const oneShot = yield* digestUtf8("sha256", text)

        expect(streamed).toEqual(oneShot)
      }),
    { fastCheck: { numRuns: 200 } }
  )

  it.effect("malformed kind and absolute index are partition invariant", () =>
    Effect.forEach(
      [
        {
          text: "a\uD800b",
          expected: new InvalidUnicode({ kind: "lone-high-surrogate", codeUnitIndex: 1 })
        },
        {
          text: "a\uDC00b",
          expected: new InvalidUnicode({ kind: "lone-low-surrogate", codeUnitIndex: 1 })
        },
        {
          text: "a\uD800\uD801b",
          expected: new InvalidUnicode({ kind: "lone-high-surrogate", codeUnitIndex: 1 })
        }
      ],
      ({ expected, text }) =>
        Effect.forEach(everyPartition(text), (chunks) =>
          Effect.gen(function*() {
            const exit = yield* Effect.exit(digestUtf8Stream("sha256", Stream.fromIterable(chunks)))
            expect(exit).toStrictEqual(Exit.fail(expected))
          }))
    ))
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
