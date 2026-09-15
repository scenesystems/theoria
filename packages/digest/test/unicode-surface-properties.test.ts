/**
 * Shared generated Unicode laws for every public text and canonicalization path.
 */

import { describe, expect, it } from "@effect/vitest"
import {
  Array as Arr,
  Boolean as B,
  Effect,
  Exit,
  FastCheck as fc,
  Record,
  Schema,
  Stream,
  String as Str,
  Tuple
} from "effect"

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
import { oracleUtf8 } from "./helpers/bytes.js"

const wellFormedString = fc.fullUnicodeString({ maxLength: 64 })
const JsonString = Schema.parseJson(Schema.String)

const unicodeOperations = (text: string, chunks: Stream.Stream<string>) =>
  Record.toEntries({
    encodeUtf8: Effect.asVoid(encodeUtf8(text)),
    "canonicalize root string": Effect.asVoid(canonicalize(text)),
    "canonicalize nested string": Effect.asVoid(canonicalize({ nested: Arr.of(text) })),
    "canonicalize object key": Effect.asVoid(canonicalize(Record.singleton(text, true))),
    digest: Effect.asVoid(digest("blake3-256", text)),
    digestSchemaValue: Effect.asVoid(digestSchemaValue(Schema.String, text)),
    durableFingerprint: Effect.asVoid(durableFingerprint(text)),
    canonicalJsonBytes: Effect.asVoid(canonicalJsonBytes(text)),
    digestCanonicalJsonBytes: Effect.asVoid(digestCanonicalJsonBytes("blake3-256", text)),
    digestCanonicalJsonBase64Url: Effect.asVoid(digestCanonicalJsonBase64Url("blake3-256", text)),
    digestCanonicalJsonHex: Effect.asVoid(digestCanonicalJsonHex("blake3-256", text)),
    digestUtf8: Effect.asVoid(digestUtf8("blake3-256", text)),
    digestUtf8Base64Url: Effect.asVoid(digestUtf8Base64Url("blake3-256", text)),
    digestUtf8Stream: Effect.asVoid(digestUtf8Stream("blake3-256", chunks)),
    digestUtf8StreamBase64Url: Effect.asVoid(digestUtf8StreamBase64Url("blake3-256", chunks)),
    digestUtf8StreamHex: Effect.asVoid(digestUtf8StreamHex("blake3-256", chunks)),
    "blake3DeriveKey context": Schema.decode(Schema.Uint8Array)(Arr.empty()).pipe(
      Effect.flatMap((emptyBytes) => blake3DeriveKey(text, emptyBytes)),
      Effect.asVoid
    )
  })

describe("public text and canonicalization surface — generated Unicode laws", () => {
  it.effect.prop(
    "accepts every generated well-formed string without normalization failures",
    Tuple.make(wellFormedString),
    ([text]) =>
      Effect.gen(function*() {
        yield* Effect.forEach(unicodeOperations(text, Stream.make(text)), ([label, operation]) =>
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

        expect(encodedText).toStrictEqual(yield* oracleUtf8(text))
        expect(decodedCanonical).toBe(text)
        expect(canonicalBytes).toStrictEqual(yield* oracleUtf8(canonical))
        expect(yield* digestCanonicalJsonBytes("blake3-256", text)).toStrictEqual(canonicalHash)
        expect(yield* digestCanonicalJsonBase64Url("blake3-256", text)).toBe(canonicalBase64Url)
        expect(yield* digestCanonicalJsonHex("blake3-256", text)).toBe(toHex(canonicalHash))
        expect(yield* digest("blake3-256", text)).toBe(Str.concat("blake3-256:", canonicalBase64Url))
        expect(yield* digestSchemaValue(Schema.String, text)).toBe(Str.concat("blake3-256:", canonicalBase64Url))
        expect(yield* durableFingerprint(text)).toBe(Str.concat("blake3-256:", canonicalBase64Url))
        expect(yield* digestUtf8Base64Url("blake3-256", text)).toBe(textBase64Url)
        expect(yield* digestUtf8Stream("blake3-256", Stream.make(text))).toStrictEqual(textHash)
        expect(yield* digestUtf8StreamBase64Url("blake3-256", Stream.make(text))).toBe(textBase64Url)
        expect(yield* digestUtf8StreamHex("blake3-256", Stream.make(text))).toBe(toHex(textHash))
      }),
    { fastCheck: { numRuns: 100 } }
  )

  it.effect.prop(
    "rejects injected unpaired surrogates with the exact public-origin index",
    Tuple.make(wellFormedString, wellFormedString, fc.boolean()),
    ([prefix, suffix, injectHigh]) => {
      const surrogate = B.match(injectHigh, { onTrue: () => "\uD800", onFalse: () => "\uDC00" })
      const malformed = Str.concat(Str.concat(prefix, surrogate), suffix)
      const expected = Exit.fail(
        new InvalidUnicode({
          kind: B.match(injectHigh, { onTrue: () => "lone-high-surrogate", onFalse: () => "lone-low-surrogate" }),
          codeUnitIndex: Str.length(prefix)
        })
      )

      return Effect.asVoid(
        Effect.forEach(
          unicodeOperations(malformed, Stream.make(prefix, surrogate, suffix)),
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
