import { describe, expect, it } from "@effect/vitest"
import { Boolean, Chunk, Effect, Layer, Match, Number, Option, Stream, String, Tuple } from "effect"
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
  it.effect("normalizes a fitting terminal grapheme and resumes an overflowing one", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "ab",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(testLayer))
      const exact = { maxWidth: 10, lineHeight: 12 }
      const narrow = { maxWidth: 9.99, lineHeight: 12 }
      const end = { segmentIndex: 1, graphemeIndex: 0 }
      const split = { segmentIndex: 0, graphemeIndex: 1 }

      expect(Text.ranges(prepared, exact)).toEqual(Arr.of({
        baseDirection: "ltr",
        order: "visual",
        start: Text.start,
        end,
        width: 10
      }))
      expect(Text.ranges(prepared, narrow)).toEqual(Arr.make(
        { baseDirection: "ltr", order: "visual", start: Text.start, end: split, width: 5 },
        { baseDirection: "ltr", order: "visual", start: split, end, width: 5 }
      ))
      const first = Option.getOrThrow(Text.nextLine(prepared, narrow, Text.start))
      expect(first).toEqual(Tuple.make(
        { baseDirection: "ltr", index: 0, order: "visual", text: "a", width: 5 },
        split
      ))
      expect(Text.nextLine(prepared, narrow, Tuple.getSecond(first))).toEqual(Option.some(Tuple.make(
        { baseDirection: "ltr", index: 1, order: "visual", text: "b", width: 5 },
        end
      )))
      expect(Text.nextLine(prepared, exact, end)).toEqual(Option.none())
    }))

  it.effect("consumes zero-width terminal graphemes without dropping zero-width lines", () =>
    Effect.gen(function*() {
      const layer = Layer.mergeAll(
        Text.layerSegmenter,
        Text.layerProfile,
        MeasurementCache.layer.pipe(Layer.provide(Layer.succeed(TextMeasurer.TextMeasurer, {
          measure: (_font, text) =>
            Effect.succeed(
              Match.value(text).pipe(
                Match.when(Match.is("b", "d", "z", "zz"), () => 0),
                Match.when(Match.is("ab", "cd"), () => 5),
                Match.orElse((value) => Number.multiply(String.length(value), 5))
              )
            )
        })))
      )
      const prepared = yield* Text.prepareWithSegments({
        text: "ab\ncd\nzz",
        font: { family: "Mono", size: 10 },
        whiteSpace: "pre-wrap"
      }).pipe(Effect.provide(layer))
      const request = { maxWidth: 5, lineHeight: 12 }
      expect(collectCursorLines(prepared, request)).toEqual(Arr.make(
        { baseDirection: "ltr", index: 0, order: "visual", text: "ab", width: 5 },
        { baseDirection: "ltr", index: 1, order: "visual", text: "cd", width: 5 },
        { baseDirection: "ltr", index: 2, order: "visual", text: "zz", width: 0 }
      ))
      expect(Text.summary(prepared, request)).toEqual({ height: 36, lineCount: 3, maxLineWidth: 5 })
      expect(Arr.map(Text.ranges(prepared, request), (range) => range.end)).toEqual(Arr.make(
        { segmentIndex: 1, graphemeIndex: 0 },
        { segmentIndex: 3, graphemeIndex: 0 },
        { segmentIndex: 5, graphemeIndex: 0 }
      ))
    }))

  it.effect("fits a shaped terminal advance after pending whitespace without using paint width", () =>
    Effect.gen(function*() {
      const layer = Layer.mergeAll(
        Text.layerSegmenter,
        Text.layerProfile,
        MeasurementCache.layer.pipe(Layer.provide(Layer.succeed(TextMeasurer.TextMeasurer, {
          measure: (_font, text) =>
            Effect.succeed(
              Match.value(text).pipe(
                Match.when(" ", () => 2),
                Match.when("a", () => 7),
                Match.when("b", () => 4),
                Match.when("ab", () => 9),
                Match.orElse((value) => Number.multiply(String.length(value), 5))
              )
            )
        })))
      )
      const prepared = yield* Text.prepareWithSegments({
        text: "x ab",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))
      // Fit: 5 + 2 + 7 + 2 = 16. Paint: 5 + 2 + 7 + 4 = 18.
      expect(Text.lines(prepared, { maxWidth: 16, lineHeight: 12 })).toEqual(Arr.of(
        { baseDirection: "ltr", index: 0, order: "visual", text: "x ab", width: 18 }
      ))
      expect(Text.lines(prepared, { maxWidth: 15.99, lineHeight: 12 })).toEqual(Arr.make(
        { baseDirection: "ltr", index: 0, order: "visual", text: "x", width: 5 },
        { baseDirection: "ltr", index: 1, order: "visual", text: "ab", width: 11 }
      ))
    }))

  it.effect("retains discretionary and explicit breaks after short text runs", () =>
    Effect.forEach(
      Arr.make(
        { text: "ab\u00adcd", first: "ab-", width: 15 },
        { text: "ab\u200bcd", first: "ab", width: 10 }
      ),
      (fixture) =>
        Effect.gen(function*() {
          const prepared = yield* Text.prepareWithSegments({
            text: fixture.text,
            font: { family: "Mono", size: 10 },
            whiteSpace: "normal"
          }).pipe(Effect.provide(testLayer))
          expect(Text.lines(prepared, { maxWidth: 15, lineHeight: 12 })).toEqual(Arr.make(
            { baseDirection: "ltr", index: 0, order: "visual", text: fixture.first, width: fixture.width },
            { baseDirection: "ltr", index: 1, order: "visual", text: "cd", width: 10 }
          ))
        })
    ))

  it.effect("stops before indexing empty or exhausted prepared text", () =>
    Effect.gen(function*() {
      const font = { family: "Mono", size: 10 }
      const empty = yield* Text.prepareWithSegments({ text: "", font, whiteSpace: "normal" }).pipe(
        Effect.provide(testLayer)
      )
      const prepared = yield* Text.prepareWithSegments({ text: "abc", font, whiteSpace: "normal" }).pipe(
        Effect.provide(testLayer)
      )
      const request: Text.Request = { maxWidth: 20, lineHeight: 12 }
      expect(Text.nextLine(empty, request, Text.start)).toEqual(Option.none())
      const first = Option.getOrThrow(Text.nextLine(prepared, request, Text.start))
      expect(Tuple.getFirst(first).text).toBe("abc")
      expect(Text.nextLine(prepared, request, Tuple.getSecond(first))).toEqual(Option.none())
      expect(Text.nextLine(prepared, request, { segmentIndex: 100, graphemeIndex: 0 })).toEqual(Option.none())
    }))

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

  it.effect("repeated multi-line projections reset line-local whitespace state", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "one two three",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(testLayer))
      const request: Text.Request = { maxWidth: 25, lineHeight: 12 }
      const expectedLines = Arr.make(
        { baseDirection: "ltr", index: 0, order: "visual", text: "one", width: 15 },
        { baseDirection: "ltr", index: 1, order: "visual", text: "two", width: 15 },
        { baseDirection: "ltr", index: 2, order: "visual", text: "three", width: 25 }
      )
      const expectedRanges = Arr.make(
        {
          baseDirection: "ltr",
          end: { graphemeIndex: 0, segmentIndex: 1 },
          order: "visual",
          start: { graphemeIndex: 0, segmentIndex: 0 },
          width: 15
        },
        {
          baseDirection: "ltr",
          end: { graphemeIndex: 0, segmentIndex: 3 },
          order: "visual",
          start: { graphemeIndex: 0, segmentIndex: 2 },
          width: 15
        },
        {
          baseDirection: "ltr",
          end: { graphemeIndex: 0, segmentIndex: 5 },
          order: "visual",
          start: { graphemeIndex: 0, segmentIndex: 4 },
          width: 25
        }
      )

      expect(Text.ranges(prepared, request)).toEqual(expectedRanges)
      expect(Text.lines(prepared, request)).toEqual(expectedLines)
      expect(Text.ranges(prepared, request)).toEqual(expectedRanges)
      expect(Text.lines(prepared, request)).toEqual(expectedLines)
    }))

  it.effect("keeps summary height consistent with materialized summaries for fractional line heights", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "a\nb\nc\nd\ne\nf\ng\nh\ni\nj",
        font: { family: "Mono", size: 10 },
        whiteSpace: "pre-wrap"
      }).pipe(Effect.provide(testLayer))
      const request: Text.Request = { maxWidth: 20, lineHeight: 0.1 }
      const lines = Text.lines(prepared, request)

      expect(Text.summary(prepared, request)).toEqual({ height: 1, lineCount: 10, maxLineWidth: 5 })
      expect(Text.summary(prepared, request)).toEqual(Text.summaryFromLines(lines, request.lineHeight))
      expect(Text.summary(prepared, request)).toEqual(Text.layout(prepared, request).summary)
    }))

  it.effect("resumes long tokens across scan batches without skipping the last grapheme", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: String.concat(String.repeat(129)("a"), "bc"),
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(testLayer))
      const request: Text.Request = { maxWidth: 320, lineHeight: 12 }
      const expected = Arr.make(
        { baseDirection: "ltr", index: 0, order: "visual", text: String.repeat(64)("a"), width: 320 },
        { baseDirection: "ltr", index: 1, order: "visual", text: String.repeat(64)("a"), width: 320 },
        { baseDirection: "ltr", index: 2, order: "visual", text: "abc", width: 15 }
      )

      expect(Text.lines(prepared, request)).toEqual(expected)
      expect(collectCursorLines(prepared, request)).toEqual(expected)
      expect(Text.summary(prepared, request)).toEqual({ height: 36, lineCount: 3, maxLineWidth: 320 })
      expect(Arr.map(Text.ranges(prepared, request), (range) => range.width)).toEqual(Arr.make(320, 320, 15))
    }))

  it.effect("resumes inside a long token and crosses following segments", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: String.concat(String.repeat(129)("a"), " bc"),
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(testLayer))
      const request: Text.Request = { maxWidth: 330, lineHeight: 12 }
      const resumedAt = { segmentIndex: 0, graphemeIndex: 66 }
      const resumed = Option.getOrThrow(Text.nextLine(prepared, request, resumedAt))

      expect(Tuple.getFirst(resumed)).toEqual({
        baseDirection: "ltr",
        index: 1,
        order: "visual",
        text: String.concat(String.repeat(63)("a"), " bc"),
        width: 330
      })
      expect(Tuple.getSecond(resumed)).toEqual({ segmentIndex: 3, graphemeIndex: 0 })
      expect(Text.ranges(prepared, request)).toEqual(Arr.make(
        {
          baseDirection: "ltr",
          end: { segmentIndex: 0, graphemeIndex: 66 },
          order: "visual",
          start: { segmentIndex: 0, graphemeIndex: 0 },
          width: 330
        },
        {
          baseDirection: "ltr",
          end: { segmentIndex: 3, graphemeIndex: 0 },
          order: "visual",
          start: resumedAt,
          width: 330
        }
      ))
    }))

  it.effect("keeps sequential paint rounding instead of adding a pre-summed text run", () =>
    Effect.gen(function*() {
      const layer = Layer.mergeAll(
        Text.layerSegmenter,
        Text.layerProfile,
        MeasurementCache.layer.pipe(Layer.provide(Layer.succeed(TextMeasurer.TextMeasurer, {
          measure: (_font, text) =>
            Effect.succeed(Boolean.match(String.startsWith("a")(text), {
              onTrue: () => Number.sum(1e16, Number.decrement(String.length(text))),
              onFalse: () => String.length(text)
            }))
        })))
      )
      const text = String.concat("a", String.repeat(32)("b"))
      const prepared = yield* Text.prepareWithSegments({
        text,
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(
        Effect.provide(layer)
      )
      const request: Text.Request = { maxWidth: 1e20, lineHeight: 12 }
      // At 10^16 the spacing is 2: each +1 ties to the same even value.
      // Grouping the 32 trailing unit widths first would instead add 32.
      expect(Text.lines(prepared, request)).toEqual(Arr.of(
        { baseDirection: "ltr", index: 0, order: "visual", text, width: 1e16 }
      ))
      expect(Arr.map(Text.ranges(prepared, request), (range) => range.width)).toEqual(Arr.of(1e16))
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
