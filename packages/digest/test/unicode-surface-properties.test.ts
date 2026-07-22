/**
 * Shared generated Unicode laws for every public text and canonicalization path.
 */

import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit, FastCheck as fc, Schema, Stream } from "effect"

import {
  blake3DeriveKey,
  canonicalize,
  canonicalJsonBytes,
  digest,
  digestBytes,
  digestCanonicalJsonBase64Url,
  digestCanonicalJsonBytes,
  digestCanonicalJsonHex,
  digestSchemaValue,
  digestUtf8,
  digestUtf8Base64Url,
  digestUtf8Stream,
  digestUtf8StreamBase64Url,
  digestUtf8StreamHex,
  durableFingerprint,
  encodeUtf8,
  InvalidUnicode,
  toBase64Url,
  toHex
} from "../src/index.js"

type UnicodeOperation = readonly [string, Effect.Effect<unknown, unknown>]

const wellFormedString = fc.fullUnicodeString({ maxLength: 64 })
const emptyBytes = new Uint8Array(0)
const utf8Decoder = new TextDecoder("utf-8", { fatal: true })
const JsonString = Schema.parseJson(Schema.String)

const unicodeOperations = (text: string, chunks: ReadonlyArray<string>): ReadonlyArray<UnicodeOperation> => [
  ["encodeUtf8", encodeUtf8(text)],
  ["canonicalize root string", canonicalize(text)],
  ["canonicalize nested string", canonicalize({ nested: [text] })],
  ["canonicalize object key", canonicalize({ [text]: true })],
  ["digest", digest("blake3-256", text)],
  ["digestSchemaValue", digestSchemaValue(Schema.String, text)],
  ["durableFingerprint", durableFingerprint(text)],
  ["canonicalJsonBytes", canonicalJsonBytes(text)],
  ["digestCanonicalJsonBytes", digestCanonicalJsonBytes("blake3-256", text)],
  ["digestCanonicalJsonBase64Url", digestCanonicalJsonBase64Url("blake3-256", text)],
  ["digestCanonicalJsonHex", digestCanonicalJsonHex("blake3-256", text)],
  ["digestUtf8", digestUtf8("blake3-256", text)],
  ["digestUtf8Base64Url", digestUtf8Base64Url("blake3-256", text)],
  ["digestUtf8Stream", digestUtf8Stream("blake3-256", Stream.fromIterable(chunks))],
  [
    "digestUtf8StreamBase64Url",
    digestUtf8StreamBase64Url("blake3-256", Stream.fromIterable(chunks))
  ],
  ["digestUtf8StreamHex", digestUtf8StreamHex("blake3-256", Stream.fromIterable(chunks))],
  ["blake3DeriveKey context", blake3DeriveKey(text, emptyBytes)]
]

describe("public text and canonicalization surface — generated Unicode laws", () => {
  it.effect.prop(
    "accepts every generated well-formed string without normalization failures",
    [wellFormedString],
    ([text]) =>
      Effect.gen(function*() {
        yield* Effect.forEach(unicodeOperations(text, [text]), ([label, operation]) =>
          Effect.gen(function*() {
            const exit = yield* Effect.exit(operation)

            expect(Exit.isSuccess(exit), label).toBe(true)
          }))

        const encodedText = yield* encodeUtf8(text)
        const canonical = yield* canonicalize(text)
        const decodedCanonical = yield* Schema.decodeUnknown(JsonString)(canonical)
        const canonicalBytes = yield* canonicalJsonBytes(text)
        const canonicalHash = yield* digestBytes("blake3-256", canonicalBytes)
        const canonicalBase64Url = toBase64Url(canonicalHash)
        const textHash = yield* digestUtf8("blake3-256", text)
        const textBase64Url = toBase64Url(textHash)

        expect(utf8Decoder.decode(encodedText)).toBe(text)
        expect(decodedCanonical).toBe(text)
        expect(utf8Decoder.decode(canonicalBytes)).toBe(canonical)
        expect(yield* digestCanonicalJsonBytes("blake3-256", text)).toStrictEqual(canonicalHash)
        expect(yield* digestCanonicalJsonBase64Url("blake3-256", text)).toBe(canonicalBase64Url)
        expect(yield* digestCanonicalJsonHex("blake3-256", text)).toBe(toHex(canonicalHash))
        expect(yield* digest("blake3-256", text)).toBe(`blake3-256:${canonicalBase64Url}`)
        expect(yield* digestSchemaValue(Schema.String, text)).toBe(`blake3-256:${canonicalBase64Url}`)
        expect(yield* durableFingerprint(text)).toBe(`blake3-256:${canonicalBase64Url}`)
        expect(yield* digestUtf8Base64Url("blake3-256", text)).toBe(textBase64Url)
        expect(yield* digestUtf8Stream("blake3-256", Stream.make(text))).toStrictEqual(textHash)
        expect(yield* digestUtf8StreamBase64Url("blake3-256", Stream.make(text))).toBe(textBase64Url)
        expect(yield* digestUtf8StreamHex("blake3-256", Stream.make(text))).toBe(toHex(textHash))
      }),
    { fastCheck: { numRuns: 100 } }
  )

  it.effect.prop(
    "rejects injected unpaired surrogates with the exact public-origin index",
    [wellFormedString, wellFormedString, fc.boolean()],
    ([prefix, suffix, injectHigh]) => {
      const surrogate = injectHigh ? "\uD800" : "\uDC00"
      const malformed = `${prefix}${surrogate}${suffix}`
      const expected = Exit.fail(
        new InvalidUnicode({
          kind: injectHigh ? "lone-high-surrogate" : "lone-low-surrogate",
          codeUnitIndex: prefix.length
        })
      )

      return Effect.asVoid(
        Effect.forEach(
          unicodeOperations(malformed, [prefix, surrogate, suffix]),
          ([label, operation]) =>
            Effect.gen(function*() {
              const exit = yield* Effect.exit(operation)

              expect(exit, label).toStrictEqual(expected)
            })
        )
      )
    },
    { fastCheck: { numRuns: 100 } }
  )
})
