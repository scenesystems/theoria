/** Regenerates the pinned Unicode data and independent UAX #29 conformance vectors. */
import { BunRuntime, BunServices } from "@effect/platform-bun"
import * as Utf8 from "@scenesystems/digest/Utf8"
import {
  Array as Arr,
  Boolean,
  Data,
  Effect,
  FileSystem,
  Layer,
  Number,
  Option,
  Path,
  Result,
  Schema,
  String
} from "effect"
import { FetchHttpClient, HttpClient, HttpClientResponse } from "effect/http"
import { ChildProcess } from "effect/process"

import { GraphemeData } from "../src/internal/graphemeSchema.js"

const TestCase = Schema.Struct({ input: Schema.String, expected: Schema.Array(Schema.String) })
const TestCases = Schema.Array(TestCase)
class MissingGraphemeProperty extends Data.TaggedError("MissingGraphemeProperty") {}
const words = (text: string) => Arr.filter(String.split(/\s+/u)(String.trim(text)), String.isNonEmpty)
const bodyLines = (text: string) =>
  Arr.filterMap(
    String.split("\n")(text),
    (line) =>
      Arr.head(String.split("#")(line)).pipe(
        Option.map(String.trim),
        Option.filter(String.isNonEmpty),
        Result.fromOption(() => undefined)
      )
  )

const hex = (text: string) => Schema.decodeEffect(Schema.FiniteFromString)(String.concat("0x", text))
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
  const scriptFile = yield* path.fromFileUrl(yield* Schema.decodeEffect(Schema.URLFromString)(import.meta.url))
  const root = path.dirname(path.dirname(scriptFile))
  const sources = yield* Effect.all(
    {
      conjunct: download("DerivedCoreProperties.txt"),
      emoji: download("emoji/emoji-data.txt"),
      grapheme: download("auxiliary/GraphemeBreakProperty.txt"),
      tests: download("auxiliary/GraphemeBreakTest.txt")
    },
    { concurrency: "unbounded" }
  )
  const graphemeRows = yield* propertyRows(sources.grapheme)
  const conjunctRows = yield* propertyRows(sources.conjunct)
  const emojiRows = yield* propertyRows(sources.emoji)
  const data = yield* Schema.decodeUnknownEffect(GraphemeData)({
    version: "17.0.0",
    grapheme: yield* Effect.forEach(
      graphemeRows,
      ({ start, end, fields }) =>
        Effect.fromOption(Arr.head(fields), () => new MissingGraphemeProperty()).pipe(
          Effect.map((value) => ({ start, end, value }))
        )
    ),
    conjunct: Arr.filterMap(conjunctRows, ({ start, end, fields }) =>
      Arr.head(fields).pipe(
        Option.filter((value) => String.Equivalence(value, "InCB")),
        Option.flatMap(() => Arr.get(fields, 1)),
        Option.map((value) => ({ start, end, value })),
        Result.fromOption(() => undefined)
      )),
    pictographic: Arr.filterMap(emojiRows, ({ start, end, fields }) =>
      Arr.head(fields).pipe(
        Option.filter((value) => String.Equivalence(value, "Extended_Pictographic")),
        Option.as({ start, end }),
        Result.fromOption(() => undefined)
      ))
  })
  const encodedData = yield* Schema.encodeEffect(Schema.fromJsonString(GraphemeData))(data)
  const vectors = yield* Effect.forEach(bodyLines(sources.tests), (line) =>
    Effect.gen(function*() {
      const expected = yield* Effect.forEach(
        Arr.filter(Arr.map(String.split("÷")(line), String.trim), String.isNonEmpty),
        (cluster) =>
          Effect.forEach(
            Arr.filter(words(cluster), (word) => Boolean.not(String.Equivalence(word, "×"))),
            (code) => hex(code).pipe(Effect.flatMap(Utf8.fromScalar))
          ).pipe(Effect.map((characters) => Arr.join(characters, "")))
      )
      return { input: Arr.join(expected, ""), expected }
    }))
  const encodedVectors = yield* Schema.encodeEffect(Schema.fromJsonString(TestCases))(vectors)

  const dataFile = path.join(root, "src/internal/graphemeData.json")
  const vectorsFile = path.join(root, "test/fixtures/graphemeBreak17.json")
  yield* fs.writeFileString(dataFile, String.concat(encodedData, "\n"))
  yield* fs.writeFileString(vectorsFile, String.concat(encodedVectors, "\n"))
  const prettier = yield* ChildProcess.make(
    "bunx",
    ["--no-install", "prettier", "--write", dataFile, vectorsFile],
    { cwd: root, stdout: "inherit", stderr: "inherit" }
  )
  yield* prettier.exitCode.pipe(
    Effect.filterOrElse(
      (exitCode) => Number.Equivalence(exitCode, 0),
      () => Effect.die("Prettier failed to format the generated Unicode data")
    )
  )
  yield* Effect.log("Generated Unicode 17.0.0 grapheme properties and conformance cases", {
    cases: Arr.length(vectors)
  })
})

BunRuntime.runMain(program.pipe(Effect.scoped, Effect.provide(Layer.merge(FetchHttpClient.layer, BunServices.layer))))
