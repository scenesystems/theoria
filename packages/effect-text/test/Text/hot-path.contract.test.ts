import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Layer, Number, Stream, String } from "effect"
import * as Arr from "effect/Array"
import * as MeasurementCache from "../../src/MeasurementCache.js"
import * as Text from "../../src/Text.js"
import * as TextMeasurer from "../../src/TextMeasurer.js"

const testLayer = Layer.mergeAll(
  Text.layerSegmenter,
  Text.layerProfile,
  MeasurementCache.layer.pipe(
    Layer.provide(Layer.succeed(TextMeasurer.TextMeasurer, {
      measure: (_font, text) => Effect.succeed(Number.multiply(String.length(text), 5))
    }))
  )
)

const collectCursorLines = (
  prepared: Text.WithSegments,
  request: Text.Request,
  cursor = Text.start
): Text.Lines => Arr.unfold(cursor, (position) => Text.nextLine(prepared, request, position))

describe("Text hot-path contracts", () => {
  it.effect("stream and cursor projections retain each line's text, width, and order", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "one two three four five six",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(testLayer))
      const request: Text.Request = { maxWidth: 35, lineHeight: 12 }
      const streamed = yield* Text.stream(prepared, request).pipe(
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
      const prefix = yield* Text.stream(prepared, { maxWidth: 20, lineHeight: 12 }).pipe(
        Stream.take(2),
        Stream.runCollect
      )

      expect(prefix).toEqual(Chunk.make(
        { baseDirection: "ltr", index: 0, order: "visual", text: "one", width: 15 },
        { baseDirection: "ltr", index: 1, order: "visual", text: "two", width: 15 }
      ))
    }))
})
