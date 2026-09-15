import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Match, Number, Option, Ref, Stream, String, Tuple } from "effect"
import * as Arr from "effect/Array"

import { Browser, Contracts, Errors, Text } from "../../src/index.js"

const visualLine = (
  index: number,
  text: string,
  width: number,
  baseDirection: Text.BaseTextDirectionType = "ltr"
): Text.LayoutLineType => ({
  baseDirection,
  index,
  order: "visual",
  text,
  width
})

const makeTestContext = Effect.gen(function*() {
  const measurements = yield* Ref.make(0)
  const measurerLayer = Layer.succeed(Contracts.TextMeasurer, {
    measure: (_font, text: string) =>
      Ref.update(measurements, Number.increment).pipe(Effect.as(Number.multiply(String.length(text), 5)))
  })

  return {
    measurements,
    layer: Layer.mergeAll(
      Text.WordSegmenterLive,
      Text.EngineProfileLive,
      Text.MeasurementCacheLive.pipe(Layer.provide(measurerLayer))
    )
  }
})

class EmojiCanvasContext {
  direction: Browser.CanvasTextDirectionType = "inherit"
  font = "10px sans-serif"
  textBaseline: Browser.CanvasTextBaselineType = "alphabetic"

  measureText(text: string): Browser.CanvasTextMetricsType {
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

      const narrow = Text.layout(prepared, { maxWidth: 40, lineHeight: 12 })
      const wide = Text.layout(prepared, { maxWidth: 100, lineHeight: 12 })
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
      const browserLayer = Browser.BrowserMeasurementCacheLive().pipe(
        Layer.provide(Layer.succeed(Contracts.TextMeasurer, {
          measure: (_font, measured: string) =>
            Ref.update(measurements, Number.increment).pipe(Effect.as(Number.multiply(String.length(measured), 5)))
        }))
      )

      const measure = (cacheLayer: Layer.Layer<Contracts.MeasurementCache>) =>
        Effect.gen(function*() {
          const cache = yield* Contracts.MeasurementCache
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

      expect(error).toBeInstanceOf(Errors.TextLayoutDecodeError)
    }))

  it.effect("supports a canvas-backed measurer with optional emoji correction", () =>
    Effect.gen(function*() {
      const layer = Layer.mergeAll(
        Text.WordSegmenterLive,
        Text.EngineProfileLive,
        Text.MeasurementCacheLive.pipe(
          Layer.provide(
            Browser.CanvasTextMeasurerLive({
              context: new EmojiCanvasContext(),
              emojiCorrection: true
            })
          )
        )
      )

      const prepared = yield* Text.prepareWithSegments({
        text: "A🙂B",
        font: { family: "Mono", size: 12 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))

      expect(Text.layout(prepared, { maxWidth: 100, lineHeight: 12 }).maxLineWidth).toBe(32)
    }))

  it.effect("breaks on prepared soft hyphens without making layout effectful", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepareWithSegments({
        text: "alpha\u00adbeta",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))

      expect(Text.layoutLines(prepared, { maxWidth: 30, lineHeight: 12 })).toEqual(Arr.make(
        visualLine(0, "alpha-", 30),
        visualLine(1, "beta", 20)
      ))
    }))

  it.effect("honors early and late soft-hyphen preference without changing preparation seams", () =>
    Effect.gen(function*() {
      const measurerLayer = Layer.succeed(Contracts.TextMeasurer, {
        measure: (_font, text: string) => Effect.succeed(Number.multiply(String.length(text), 5))
      })
      const prepareWithPreference = (preferEarlySoftHyphenBreak: boolean) =>
        Text.prepareWithSegments({
          text: "ab\u00adcd\u00adef",
          font: { family: "Mono", size: 10 },
          whiteSpace: "normal"
        }).pipe(
          Effect.provide(Layer.mergeAll(
            Text.WordSegmenterLive,
            Layer.succeed(Contracts.EngineProfile, {
              defaultDirection: "ltr",
              lineFitEpsilon: 0.005,
              preferEarlySoftHyphenBreak,
              preferPrefixWidthsForBreakableRuns: true,
              tabWidth: 4
            }),
            Text.MeasurementCacheLive.pipe(Layer.provide(measurerLayer))
          ))
        )
      const early = yield* prepareWithPreference(true)
      const late = yield* prepareWithPreference(false)
      const request = { maxWidth: 25, lineHeight: 12 }

      expect(Arr.head(Text.layoutLines(early, request)).pipe(Option.map((line) => line.text))).toEqual(
        Option.some("ab-")
      )
      expect(Arr.head(Text.layoutLines(late, request)).pipe(Option.map((line) => line.text))).toEqual(
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

      expect(Text.layoutLines(prepared, { maxWidth: 100, lineHeight: 12 })).toEqual(Arr.of(
        visualLine(0, "a\tb", 25)
      ))
    }))

  it.effect("accepts rich handles for summaries while reserving materialization for rich handles", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const input: Text.PrepareInputType = {
        text: "alpha beta gamma",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }
      const summaryPrepared = yield* Text.prepare(input).pipe(Effect.provide(layer))
      const materializedPrepared = yield* Text.prepareWithSegments(input).pipe(Effect.provide(layer))
      const request = { maxWidth: 40, lineHeight: 12 }

      expect(Text.layout(summaryPrepared, request)).toEqual(Text.layout(materializedPrepared, request))
      expect(Arr.map(Text.layoutLines(materializedPrepared, request), (line) => line.text)).toEqual(
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

      const summary = Text.layout(prepared, { maxWidth: 300, lineHeight: 12 })
      const lines = Text.layoutLines(prepared, { maxWidth: 300, lineHeight: 12 })

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

      const lines = Text.layoutLines(prepared, { maxWidth: 300, lineHeight: 12 })
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

      const lines = Text.layoutLines(prepared, { maxWidth: 300, lineHeight: 12 })
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

      const lines = Text.layoutLines(prepared, { maxWidth: 11, lineHeight: 12 })
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

      const lines = Text.layoutLines(prepared, { maxWidth: 45, lineHeight: 12 })
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

      const lines = Text.layoutLines(prepared, { maxWidth: 200, lineHeight: 12 })
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

      const lines = Text.layoutLines(prepared, { maxWidth: 200, lineHeight: 12 })
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
      const a = Text.layoutLines(prepared, request)
      const b = Text.layoutLines(prepared, request)
      const c = Text.layoutLines(prepared, request)

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
      const lines = Text.layoutLines(prepared, request)

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
      const projected = Text.layoutLinesWith(
        prepared,
        request,
        maxWidthAtLine
      )
      const uniform = Text.layoutLines(prepared, request)

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

      const lines = Text.layoutLines(prepared, { maxWidth: 35, lineHeight: 12 })

      expect(Arr.map(lines, (line) => line.text)).toEqual(Arr.make("alpha", "beta", "gamma"))
    }))

  it.effect("walkLineRanges matches the widths produced by layoutLines", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepareWithSegments({
        text: "alpha beta gamma delta",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))

      const request = { maxWidth: 40, lineHeight: 12 }
      const ranges = Text.walkLineRanges(prepared, request)
      const lines = Text.layoutLines(prepared, request)

      expect(Arr.head(ranges).pipe(Option.map((range) => range.start))).toEqual(Option.some(Text.initialCursor()))
      expect(Arr.map(ranges, (range) => range.width)).toEqual(Arr.map(lines, (line) => line.width))
    }))

  it.effect("measureNaturalWidth returns the widest forced line width", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepareWithSegments({
        text: "a\tb\ncccc",
        font: { family: "Mono", size: 10 },
        whiteSpace: "pre-wrap"
      }).pipe(Effect.provide(layer))

      expect(Text.measureNaturalWidth(prepared)).toBe(25)
    }))

  it.effect("stream produces the same lines as layoutLines", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepareWithSegments({
        text: "alpha beta gamma delta",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))

      const request = { maxWidth: 40, lineHeight: 12 }
      const directLines = Text.layoutLines(prepared, request)
      const streamedLines = yield* Stream.runCollect(Text.streamLines(prepared, request))

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
      const first = Text.layoutNextLine(prepared, narrowRequest, Text.initialCursor())
      const hintedCursor = Option.match(first, {
        onNone: Text.initialCursor,
        onSome: Tuple.getSecond
      })
      expect(Option.map(Text.layoutNextLine(prepared, wideRequest, hintedCursor), (step) => Tuple.getFirst(step).index))
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
      const directLines = Text.layoutLines(prepared, request)

      const collectCursorLines = (
        cursor: Text.LayoutCursorType
      ): Text.LayoutLinesType =>
        Option.match(Text.layoutNextLine(prepared, request, cursor), {
          onNone: Arr.empty<Text.LayoutLineType>,
          onSome: (step) =>
            Arr.prepend(
              collectCursorLines(Tuple.getSecond(step)),
              Tuple.getFirst(step)
            )
        })

      const cursorLines = collectCursorLines(Text.initialCursor())

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
      const lines = Text.layoutLines(prepared, { maxWidth: 300, lineHeight: 12 })

      expect(Arr.length(lines)).toBe(1500)
      expect(Arr.head(lines).pipe(Option.map((line) => line.text))).toEqual(Option.some("line-0"))
      expect(Arr.last(lines).pipe(Option.map((line) => line.text))).toEqual(Option.some("line-1499"))
    }))
})
