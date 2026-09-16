import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Match, Number, Option, pipe, Ref, Stream, String, Tuple } from "effect"
import * as Arr from "effect/Array"

import * as CanvasTextMeasurer from "../../src/CanvasTextMeasurer.js"
import * as MeasurementCache from "../../src/MeasurementCache.js"
import * as Text from "../../src/Text.js"
import * as TextMeasurer from "../../src/TextMeasurer.js"

const visualLine = (
  index: number,
  text: string,
  width: number,
  baseDirection: Text.Direction = "ltr"
): Text.Line => ({
  baseDirection,
  index,
  order: "visual",
  text,
  width
})

const makeTestContext = Effect.gen(function*() {
  const measurements = yield* Ref.make(0)
  const measurerLayer = Layer.succeed(TextMeasurer.TextMeasurer, {
    measure: (_font, text: string) =>
      Ref.update(measurements, Number.increment).pipe(Effect.as(Number.multiply(String.length(text), 5)))
  })

  return {
    measurements,
    layer: Layer.mergeAll(
      Text.layerSegmenter,
      Text.layerProfile,
      MeasurementCache.layer.pipe(Layer.provide(measurerLayer))
    )
  }
})

class EmojiCanvasContext {
  direction: CanvasTextMeasurer.Direction = "inherit"
  font = "10px sans-serif"
  textBaseline: CanvasTextMeasurer.Baseline = "alphabetic"

  measureText(text: string): CanvasTextMeasurer.Metrics {
    return {
      width: Match.value(text).pipe(
        Match.when("🙂", () => 4),
        Match.when("AB", () => 20),
        Match.when("A🙂B", () => 22),
        Match.orElse((value) => Number.multiply(String.length(value), 10))
      )
    }
  }
}

describe("Text operations", () => {
  it.effect("prepares once, caches repeated measurements, and keeps layout pure", () =>
    Effect.gen(function*() {
      const { measurements, layer } = yield* makeTestContext
      const prepared = yield* Text.prepareWithSegments({
        text: "hello hello",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))

      const afterPrepare = yield* Ref.get(measurements)
      expect(afterPrepare).toBeGreaterThan(1)

      const narrow = Text.summary(prepared, { maxWidth: 40, lineHeight: 12 })
      const wide = Text.summary(prepared, { maxWidth: 100, lineHeight: 12 })
      const afterLayout = yield* Ref.get(measurements)

      expect(afterLayout).toBe(afterPrepare)
      expect(narrow.lineCount).toBe(2)
      expect(wide.lineCount).toBe(1)
    }))

  it.effect("caches measurements by structure: lone surrogates measure, and an omitted weight is the normal weight", () =>
    Effect.gen(function*() {
      const { measurements, layer } = yield* makeTestContext
      const text = "\uD800 unpaired"
      const font = { family: "Mono \uDC00", size: 10 }
      const browserLayer = MeasurementCache.layer.pipe(
        Layer.provide(Layer.succeed(TextMeasurer.TextMeasurer, {
          measure: (_font, measured: string) =>
            Ref.update(measurements, Number.increment).pipe(Effect.as(Number.multiply(String.length(measured), 5)))
        }))
      )

      const measure = (cacheLayer: Layer.Layer<MeasurementCache.MeasurementCache>) =>
        Effect.gen(function*() {
          const cache = yield* MeasurementCache.MeasurementCache
          const omittedWeight = yield* cache.measure(font, text)
          const explicitWeight = yield* cache.measure({ ...font, weight: 400 }, text)

          expect(omittedWeight).toBe(Number.multiply(String.length(text), 5))
          expect(explicitWeight).toBe(omittedWeight)
        }).pipe(Effect.provide(cacheLayer))

      yield* measure(layer)
      expect(yield* Ref.get(measurements)).toBe(1)
      yield* measure(browserLayer)
      expect(yield* Ref.get(measurements)).toBe(2)
    }))

  it.effect("rejects excess properties at the prepare boundary", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const error = yield* Effect.flip(
        Text.prepareUnknown({
          text: "hello",
          font: { family: "Mono", size: 10 },
          whiteSpace: "normal",
          extra: true
        }).pipe(Effect.provide(layer))
      )

      expect(error).toBeInstanceOf(Text.DecodeError)
    }))

  it.effect("supports a canvas-backed measurer with optional emoji correction", () =>
    Effect.gen(function*() {
      const layer = Layer.mergeAll(
        Text.layerSegmenter,
        Text.layerProfile,
        MeasurementCache.layer.pipe(
          Layer.provide(
            CanvasTextMeasurer.layer(
              new CanvasTextMeasurer.Options({
                context: new EmojiCanvasContext(),
                emojiCorrection: true
              })
            )
          )
        )
      )

      const prepared = yield* Text.prepareWithSegments({
        text: "A🙂B",
        font: { family: "Mono", size: 12 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))

      expect(Text.summary(prepared, { maxWidth: 100, lineHeight: 12 }).maxLineWidth).toBe(32)
    }))

  it.effect("breaks on prepared soft hyphens without making layout effectful", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepareWithSegments({
        text: "alpha\u00adbeta",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))

      expect(Text.lines(prepared, { maxWidth: 30, lineHeight: 12 })).toEqual(Arr.make(
        visualLine(0, "alpha-", 30),
        visualLine(1, "beta", 20)
      ))
    }))

  it.effect("honors early and late soft-hyphen preference without changing preparation seams", () =>
    Effect.gen(function*() {
      const measurerLayer = Layer.succeed(TextMeasurer.TextMeasurer, {
        measure: (_font, text: string) => Effect.succeed(Number.multiply(String.length(text), 5))
      })
      const prepareWithPreference = (preferEarlySoftHyphenBreak: boolean) =>
        Text.prepareWithSegments({
          text: "ab\u00adcd\u00adef",
          font: { family: "Mono", size: 10 },
          whiteSpace: "normal"
        }).pipe(
          Effect.provide(Layer.mergeAll(
            Text.layerSegmenter,
            Layer.succeed(Text.CurrentProfile, {
              defaultDirection: "ltr",
              lineFitEpsilon: 0.005,
              preferEarlySoftHyphenBreak,
              preferPrefixWidthsForBreakableRuns: true,
              tabWidth: 4
            }),
            MeasurementCache.layer.pipe(Layer.provide(measurerLayer))
          ))
        )
      const early = yield* prepareWithPreference(true)
      const late = yield* prepareWithPreference(false)
      const request = { maxWidth: 25, lineHeight: 12 }

      expect(Arr.head(Text.lines(early, request)).pipe(Option.map((line) => line.text))).toEqual(
        Option.some("ab-")
      )
      expect(Arr.head(Text.lines(late, request)).pipe(Option.map((line) => line.text))).toEqual(
        Option.some("abcd-")
      )
    }))

  it.effect("treats tabs as pure layout-time advances derived from prepared metadata", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepareWithSegments({
        text: "a\tb",
        font: { family: "Mono", size: 10 },
        whiteSpace: "pre-wrap"
      }).pipe(Effect.provide(layer))

      expect(Text.lines(prepared, { maxWidth: 100, lineHeight: 12 })).toEqual(Arr.of(
        visualLine(0, "a\tb", 25)
      ))
    }))

  it.effect("accepts rich handles for summaries while reserving materialization for rich handles", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const input: Text.Input = {
        text: "alpha beta gamma",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }
      const summaryPrepared = yield* Text.prepare(input).pipe(Effect.provide(layer))
      const materializedPrepared = yield* Text.prepareWithSegments(input).pipe(Effect.provide(layer))
      const request = { maxWidth: 40, lineHeight: 12 }
      const layout = Text.layout(materializedPrepared, request)

      expect(Text.summary(summaryPrepared, request)).toEqual(Text.summary(materializedPrepared, request))
      expect(pipe(materializedPrepared, Text.lines(request))).toEqual(layout.lines)
      expect(Text.summaryFromLines(layout.lines, request.lineHeight)).toEqual(layout.summary)
      expect(Arr.map(layout.lines, (line) => line.text)).toEqual(
        Arr.make("alpha", "beta", "gamma")
      )
    }))
})

describe("Text edge cases and robustness", () => {
  it.effect("handles empty string input", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepareWithSegments({
        text: "",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))

      const summary = Text.summary(prepared, { maxWidth: 300, lineHeight: 12 })
      const lines = Text.lines(prepared, { maxWidth: 300, lineHeight: 12 })

      expect(summary.lineCount).toBe(0)
      expect(summary.height).toBe(0)
      expect(summary.maxLineWidth).toBe(0)
      expect(lines).toEqual(Arr.empty())
    }))

  it.effect("handles single-character input", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepareWithSegments({
        text: "x",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))

      const lines = Text.lines(prepared, { maxWidth: 300, lineHeight: 12 })
      expect(lines).toEqual(Arr.of(visualLine(0, "x", 5)))
    }))

  it.effect("handles whitespace-only input in normal mode", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepareWithSegments({
        text: "   ",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))

      const lines = Text.lines(prepared, { maxWidth: 300, lineHeight: 12 })
      expect(lines).toEqual(Arr.empty())
    }))

  it.effect("handles very narrow maxWidth forcing one word per line", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepareWithSegments({
        text: "ab cd ef",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))

      const lines = Text.lines(prepared, { maxWidth: 11, lineHeight: 12 })
      expect(Arr.length(lines)).toBe(3)
      expect(Arr.map(lines, (line) => line.text)).toEqual(Arr.make("ab", "cd", "ef"))
    }))

  it.effect("handles text that exactly fills the line width", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepareWithSegments({
        text: "abcd efgh",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))

      const lines = Text.lines(prepared, { maxWidth: 45, lineHeight: 12 })
      expect(Arr.map(lines, (line) => line.text)).toEqual(Arr.of("abcd efgh"))
    }))

  it.effect("handles multiple consecutive spaces in pre-wrap mode", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepareWithSegments({
        text: "a   b",
        font: { family: "Mono", size: 10 },
        whiteSpace: "pre-wrap"
      }).pipe(Effect.provide(layer))

      const lines = Text.lines(prepared, { maxWidth: 200, lineHeight: 12 })
      expect(Arr.map(lines, (line) => line.text)).toEqual(Arr.of("a   b"))
    }))

  it.effect("handles multiple newlines in pre-wrap mode", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepareWithSegments({
        text: "a\n\nb",
        font: { family: "Mono", size: 10 },
        whiteSpace: "pre-wrap"
      }).pipe(Effect.provide(layer))

      const lines = Text.lines(prepared, { maxWidth: 200, lineHeight: 12 })
      expect(Arr.length(lines)).toBe(3)
      expect(Arr.map(lines, (line) => line.text)).toEqual(Arr.make("a", "", "b"))
    }))

  it.effect("layout is idempotent across repeated calls", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepareWithSegments({
        text: "The quick brown fox jumps over the lazy dog",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))

      const request = { maxWidth: 80, lineHeight: 14 }
      const a = Text.lines(prepared, request)
      const b = Text.lines(prepared, request)
      const c = Text.lines(prepared, request)

      expect(a).toEqual(b)
      expect(b).toEqual(c)
    }))

  it.effect("every line width is at most maxWidth", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepareWithSegments({
        text: "The quick brown fox jumps over the lazy dog near a stream of flowing water",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))

      const request = { maxWidth: 60, lineHeight: 14 }
      const lines = Text.lines(prepared, request)

      Arr.forEach(lines, (line) => {
        expect(line.width).toBeLessThanOrEqual(Number.sum(request.maxWidth, 0.01))
      })
    }))

  it.effect("supports per-line max-width projection without re-preparing", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepareWithSegments({
        text: "The quick brown fox jumps over the lazy dog near a stream of flowing water",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))

      const request = { maxWidth: 80, lineHeight: 14 }
      const maxWidthAtLine = (lineIndex: number): number =>
        Match.value(lineIndex).pipe(
          Match.when(0, () => request.maxWidth),
          Match.orElse(() => 40)
        )
      const projected = Text.linesWith(
        prepared,
        request,
        maxWidthAtLine
      )
      const uniform = Text.lines(prepared, request)

      expect(Arr.length(projected)).toBeGreaterThan(Arr.length(uniform))
      Arr.forEach(projected, (line) => {
        const maxWidth = maxWidthAtLine(line.index)
        expect(line.width).toBeLessThanOrEqual(Number.sum(maxWidth, 0.01))
      })
    }))

  it.effect("wraps at the last available word boundary before falling back to graphemes", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepareWithSegments({
        text: "alpha beta gamma",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))

      const lines = Text.lines(prepared, { maxWidth: 35, lineHeight: 12 })

      expect(Arr.map(lines, (line) => line.text)).toEqual(Arr.make("alpha", "beta", "gamma"))
    }))

  it.effect("ranges matches the widths produced by lines", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepareWithSegments({
        text: "alpha beta gamma delta",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))

      const request = { maxWidth: 40, lineHeight: 12 }
      const ranges = Text.ranges(prepared, request)
      const lines = Text.lines(prepared, request)

      expect(Arr.head(ranges).pipe(Option.map((range) => range.start))).toEqual(Option.some(Text.start))
      expect(Arr.map(ranges, (range) => range.width)).toEqual(Arr.map(lines, (line) => line.width))
    }))

  it.effect("supports data-first and data-last ranges with optional per-line widths", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepareWithSegments({
        text: "alpha beta gamma delta",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))
      const request = { maxWidth: 40, lineHeight: 12 }
      const resolveMaxWidth = (lineIndex: number): number =>
        Match.value(lineIndex).pipe(
          Match.when(0, () => 55),
          Match.orElse(() => 30)
        )

      const uniformDataFirst = Text.ranges(prepared, request)
      const uniformDataLast = pipe(prepared, Text.ranges(request))
      const variableDataFirst = Text.ranges(prepared, request, resolveMaxWidth)
      const variableDataLast = pipe(prepared, Text.ranges(request, resolveMaxWidth))

      expect(uniformDataLast).toEqual(uniformDataFirst)
      expect(variableDataLast).toEqual(variableDataFirst)
      expect(Arr.map(variableDataFirst, (range) => range.width)).not.toEqual(
        Arr.map(uniformDataFirst, (range) => range.width)
      )
    }))

  it.effect("naturalWidth returns the widest forced line width", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepareWithSegments({
        text: "a\tb\ncccc",
        font: { family: "Mono", size: 10 },
        whiteSpace: "pre-wrap"
      }).pipe(Effect.provide(layer))

      expect(Text.naturalWidth(prepared)).toBe(25)
    }))

  it.effect("stream produces the same values as lines", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepareWithSegments({
        text: "alpha beta gamma delta",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))

      const request = { maxWidth: 40, lineHeight: 12 }
      const directLines = Text.lines(prepared, request)
      const streamedLines = yield* Stream.runCollect(Text.stream(prepared, request))

      expect(Arr.fromIterable(streamedLines)).toEqual(directLines)
    }))

  it.effect("cursor hints remain width-specific when a cursor is reused at another width", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepareWithSegments({
        text: "one two three four five six",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))
      const narrowRequest = { maxWidth: 35, lineHeight: 12 }
      const wideRequest = { maxWidth: 80, lineHeight: 12 }
      const first = Text.nextLine(prepared, narrowRequest, Text.start)
      const hintedCursor = Option.match(first, {
        onNone: () => Text.start,
        onSome: Tuple.getSecond
      })
      expect(Option.map(Text.nextLine(prepared, wideRequest, hintedCursor), (step) => Tuple.getFirst(step).index))
        .toEqual(
          Option.some(0)
        )
    }))

  it.effect("cursor-based iteration covers all lines", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepareWithSegments({
        text: "one two three four five",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))

      const request = { maxWidth: 25, lineHeight: 12 }
      const directLines = Text.lines(prepared, request)

      const collectCursorLines = (
        cursor: Text.Cursor
      ): Text.Lines =>
        Option.match(Text.nextLine(prepared, request, cursor), {
          onNone: Arr.empty<Text.Line>,
          onSome: (step) =>
            Arr.prepend(
              collectCursorLines(Tuple.getSecond(step)),
              Tuple.getFirst(step)
            )
        })

      const cursorLines = collectCursorLines(Text.start)

      expect(cursorLines).toEqual(directLines)
    }))

  it.effect("walks many hard-break chunks without recursive overflow", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const text = Arr.join(Arr.makeBy(1500, (index) => `line-${index}`), "\n")
      const prepared = yield* Text.prepareWithSegments({
        text,
        font: { family: "Mono", size: 10 },
        whiteSpace: "pre-wrap"
      }).pipe(Effect.provide(layer))
      const lines = Text.lines(prepared, { maxWidth: 300, lineHeight: 12 })

      expect(Arr.length(lines)).toBe(1500)
      expect(Arr.head(lines).pipe(Option.map((line) => line.text))).toEqual(Option.some("line-0"))
      expect(Arr.last(lines).pipe(Option.map((line) => line.text))).toEqual(Option.some("line-1499"))
    }))
})
