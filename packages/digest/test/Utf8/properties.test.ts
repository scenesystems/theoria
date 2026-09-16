/** Shared generated Unicode laws for every public text and canonicalization path. */

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

import { CanonicalJson, ContentDigest, Digest, Utf8 } from "@scenesystems/digest"
import { oracleUtf8 } from "../helpers/bytes.js"

const wellFormedString = fc.fullUnicodeString({ maxLength: 64 })
const JsonString = Schema.parseJson(Schema.String)

const unicodeOperations = (text: string, chunks: Stream.Stream<string>) =>
  Record.toEntries({
    "Utf8.encode": Effect.asVoid(Utf8.encode(text)),
    "CanonicalJson.encode root string": Effect.asVoid(CanonicalJson.encode(text)),
    "CanonicalJson.encode nested string": Effect.asVoid(CanonicalJson.encode({ nested: Arr.of(text) })),
    "CanonicalJson.encode object key": Effect.asVoid(CanonicalJson.encode(Record.singleton(text, true))),
    "ContentDigest.fromUnknown": Effect.asVoid(ContentDigest.fromUnknown("blake3-256", text)),
    "ContentDigest.fromSchema": Effect.asVoid(ContentDigest.fromSchema(Schema.String, text)),
    "CanonicalJson.encodeBytes": Effect.asVoid(CanonicalJson.encodeBytes(text)),
    "Digest.hashString": Effect.asVoid(Digest.hashString("blake3-256", text)),
    "Digest.hashStringStream": Effect.asVoid(Digest.hashStringStream("blake3-256", chunks))
  })

describe("public text and canonicalization surface — generated Unicode laws", () => {
  it.effect.prop(
    "accepts every generated well-formed string without normalization failures",
    Tuple.make(wellFormedString),
    ([text]) =>
      Effect.gen(function*() {
        yield* Effect.forEach(unicodeOperations(text, Stream.make(text)), ([label, operation]) =>
          Effect.gen(function*() {
            expect(Exit.isSuccess(yield* Effect.exit(operation)), label).toBe(true)
          }))

        const encodedText = yield* Utf8.encode(text)
        const canonical = yield* CanonicalJson.encode(text)
        const decodedCanonical = yield* Schema.decodeUnknown(JsonString)(canonical)
        const canonicalBytes = yield* CanonicalJson.encodeBytes(text)
        const canonicalDigest = ContentDigest.fromBytes("blake3-256", canonicalBytes)
        const unknownDigest = yield* ContentDigest.fromUnknown("blake3-256", text)
        const schemaDigest = yield* ContentDigest.fromSchema(Schema.String, text)
        const textHash = yield* Digest.hashString("blake3-256", text)

        expect(encodedText).toStrictEqual(yield* oracleUtf8(text))
        expect(decodedCanonical).toBe(text)
        expect(canonicalBytes).toStrictEqual(yield* oracleUtf8(canonical))
        expect(unknownDigest).toStrictEqual(canonicalDigest)
        expect(schemaDigest).toStrictEqual(canonicalDigest)
        expect(yield* Digest.hashStringStream("blake3-256", Stream.make(text))).toStrictEqual(textHash)
      }),
    { fastCheck: { numRuns: 100, seed: 3629 } }
  )

  it.effect.prop(
    "rejects injected unpaired surrogates with the exact public-origin index",
    Tuple.make(wellFormedString, wellFormedString, fc.boolean()),
    ([prefix, suffix, injectHigh]) => {
      const surrogate = B.match(injectHigh, { onTrue: () => "\uD800", onFalse: () => "\uDC00" })
      const malformed = Str.concat(Str.concat(prefix, surrogate), suffix)
      const expected = Exit.fail(
        new Utf8.InvalidUnicode({
          kind: B.match(injectHigh, { onTrue: () => "lone-high-surrogate", onFalse: () => "lone-low-surrogate" }),
          codeUnitIndex: Str.length(prefix)
        })
      )

      return Effect.asVoid(
        Effect.forEach(
          unicodeOperations(malformed, Stream.make(prefix, surrogate, suffix)),
          ([label, operation]) =>
            Effect.gen(function*() {
              expect(yield* Effect.exit(operation), label).toStrictEqual(expected)
            })
        )
      )
    },
    { fastCheck: { numRuns: 100, seed: 3629 } }
  )
})
