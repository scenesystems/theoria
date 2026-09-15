/** Regenerates the pinned Unicode data and independent UAX #29 conformance vectors. */
import { FetchHttpClient, FileSystem, HttpClient, HttpClientResponse, Path, Url } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { fromUnicodeScalar } from "@scenesystems/digest"
import { Array as Arr, Boolean, Effect, Layer, Option, Schema, String } from "effect"

import { GraphemeData } from "../src/Text/internal/graphemeSchema.js"

const TestCase = Schema.Struct({ input: Schema.String, expected: Schema.Array(Schema.String) })
const TestCases = Schema.Array(TestCase)
const words = (text: string) => Arr.filter(String.split(/\s+/u)(String.trim(text)), String.isNonEmpty)
const bodyLines = (text: string) =>
  Arr.filterMap(
    String.split("\n")(text),
    (line) => Arr.head(String.split("#")(line)).pipe(Option.map(String.trim), Option.filter(String.isNonEmpty))
  )

const hex = (text: string) => Schema.decode(Schema.NumberFromString)(String.concat("0x", text))
const range = (text: string) =>
  Effect.gen(function*() {
    const parts = String.split("..")(text)
    const start = yield* hex(Arr.headNonEmpty(parts))
    const end = yield* hex(Arr.lastNonEmpty(parts))
    return { start, end }
  })

const propertyRows = (text: string) =>
  Effect.forEach(bodyLines(text), (line) =>
    Effect.gen(function*() {
      const fields = Arr.map(String.split(";")(line), String.trim)
      const bounds = yield* range(Arr.headNonEmpty(fields))
      return { ...bounds, fields: Arr.drop(fields, 1) }
    }))

const download = (path: string) =>
  HttpClient.get(String.concat("https://www.unicode.org/Public/17.0.0/ucd/", path)).pipe(
    Effect.flatMap(HttpClientResponse.filterStatusOk),
    Effect.flatMap((response) => response.text)
  )

const program = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const root = yield* path.fromFileUrl(yield* Url.fromString("../", import.meta.url))
  const graphemeRows = yield* download("auxiliary/GraphemeBreakProperty.txt").pipe(Effect.flatMap(propertyRows))
  const conjunctRows = yield* download("DerivedCoreProperties.txt").pipe(Effect.flatMap(propertyRows))
  const emojiRows = yield* download("emoji/emoji-data.txt").pipe(Effect.flatMap(propertyRows))
  const data = yield* Schema.decodeUnknown(GraphemeData)({
    version: "17.0.0",
    grapheme: yield* Effect.forEach(
      graphemeRows,
      ({ start, end, fields }) => Effect.map(Arr.head(fields), (value) => ({ start, end, value }))
    ),
    conjunct: Arr.filterMap(conjunctRows, ({ start, end, fields }) =>
      Arr.head(fields).pipe(
        Option.filter((value) => String.Equivalence(value, "InCB")),
        Option.flatMap(() => Arr.get(fields, 1)),
        Option.map((value) => ({ start, end, value }))
      )),
    pictographic: Arr.filterMap(emojiRows, ({ start, end, fields }) =>
      Arr.head(fields).pipe(
        Option.filter((value) => String.Equivalence(value, "Extended_Pictographic")),
        Option.as({ start, end })
      ))
  })
  const encodedData = yield* Schema.encode(Schema.parseJson(GraphemeData))(data)
  yield* fs.writeFileString(path.join(root, "src/Text/internal/graphemeData.json"), String.concat(encodedData, "\n"))

  const testText = yield* download("auxiliary/GraphemeBreakTest.txt")
  const vectors = yield* Effect.forEach(bodyLines(testText), (line) =>
    Effect.gen(function*() {
      const expected = yield* Effect.forEach(
        Arr.filter(Arr.map(String.split("÷")(line), String.trim), String.isNonEmpty),
        (cluster) =>
          Effect.forEach(
            Arr.filter(words(cluster), (word) => Boolean.not(String.Equivalence(word, "×"))),
            (code) => hex(code).pipe(Effect.flatMap(fromUnicodeScalar))
          ).pipe(Effect.map((characters) => Arr.join(characters, "")))
      )
      return { input: Arr.join(expected, ""), expected }
    }))
  const encodedVectors = yield* Schema.encode(Schema.parseJson(TestCases))(vectors)
  yield* fs.writeFileString(path.join(root, "test/fixtures/graphemeBreak17.json"), String.concat(encodedVectors, "\n"))
  yield* Effect.log("Generated Unicode 17.0.0 grapheme properties and conformance cases", {
    cases: Arr.length(vectors)
  })
})

BunRuntime.runMain(program.pipe(Effect.provide(Layer.merge(FetchHttpClient.layer, BunContext.layer))))
