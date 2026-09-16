import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Layer, Number, Stream, String } from "effect"
import * as Arr from "effect/Array"
import { Contracts, Text } from "../../src/index.js"
import type { LayoutRequestType } from "../../src/Text/schema.js"

const testLayer = Layer.mergeAll(
  Text.WordSegmenterLive,
  Text.EngineProfileLive,
  Text.MeasurementCacheLive.pipe(
    Layer.provide(Layer.succeed(Contracts.TextMeasurer, {
      measure: (_font, text) => Effect.succeed(Number.multiply(String.length(text), 5))
    }))
  )
)

const collectCursorLines = (
  prepared: Text.PreparedTextWithSegments,
  request: LayoutRequestType,
  cursor = Text.initialCursor()
): Text.LayoutLinesType => Arr.unfold(cursor, (position) => Text.layoutNextLine(prepared, request, position))

describe("Text hot-path contracts", () => {
  it.effect("stream and cursor projections retain each line's text, width, and order", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "one two three four five six",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(testLayer))
      const request: LayoutRequestType = { maxWidth: 35, lineHeight: 12 }
      const streamed = yield* Text.streamLines(prepared, request).pipe(
        Stream.runCollect,
        Effect.map(Arr.fromIterable)
      )
      const cursorLines = collectCursorLines(prepared, request)
      const expected = Arr.make(
        { baseDirection: "ltr", index: 0, order: "visual", text: "one two", width: 35 },
        { baseDirection: "ltr", index: 1, order: "visual", text: "three", width: 25 },
        { baseDirection: "ltr", index: 2, order: "visual", text: "four", width: 20 },
        { baseDirection: "ltr", index: 3, order: "visual", text: "five", width: 20 },
        { baseDirection: "ltr", index: 4, order: "visual", text: "six", width: 15 }
      )

      expect(streamed).toEqual(expected)
      expect(cursorLines).toEqual(expected)
    }))

  it.effect("taking a stream prefix returns only the requested initial lines", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "one two three four five six",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(testLayer))
      const prefix = yield* Text.streamLines(prepared, { maxWidth: 20, lineHeight: 12 }).pipe(
        Stream.take(2),
        Stream.runCollect
      )

      expect(prefix).toEqual(Chunk.make(
        { baseDirection: "ltr", index: 0, order: "visual", text: "one", width: 15 },
        { baseDirection: "ltr", index: 1, order: "visual", text: "two", width: 15 }
      ))
    }))
})
