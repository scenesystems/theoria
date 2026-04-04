import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Match, Option, Ref, Stream } from "effect"
import * as Arr from "effect/Array"
import * as Order from "effect/Order"
import * as Record from "effect/Record"

import { Browser, Contracts, Errors, Text } from "../../src/index.js"
import { preparedTextCore, preparedTextWithSegmentsCore } from "../../src/Text/model.js"

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
    measure: (_font, text: string) => Ref.update(measurements, (count) => count + 1).pipe(Effect.as(text.length * 5))
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
  direction: "inherit" = "inherit"
  font = "10px sans-serif"
  textBaseline: "alphabetic" = "alphabetic"

  measureText(text: string): { readonly width: number } {
    return {
      width: Match.value(text).pipe(
        Match.when("🙂", () => 4),
        Match.when("AB", () => 20),
        Match.when("A🙂B", () => 22),
        Match.orElse((value) => value.length * 10)
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

      expect(Text.layoutLines(prepared, { maxWidth: 30, lineHeight: 12 })).toEqual([
        visualLine(0, "alpha-", 30),
        visualLine(1, "beta", 20)
      ])
    }))

  it.effect("treats tabs as pure layout-time advances derived from prepared metadata", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepareWithSegments({
        text: "a\tb",
        font: { family: "Mono", size: 10 },
        whiteSpace: "pre-wrap"
      }).pipe(Effect.provide(layer))

      expect(Text.layoutLines(prepared, { maxWidth: 100, lineHeight: 12 })).toEqual([
        visualLine(0, "a\tb", 25)
      ])
    }))

  it.effect("stores base direction and per-segment bidi metadata during prepare", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepareWithSegments({
        text: "שלום hello",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))

      const core = preparedTextWithSegmentsCore(prepared)

      expect(core.kernel.baseDirection).toBe("rtl")
      expect(
        Arr.map(
          Arr.filter(core.logicalSurface.segments, (segment) => segment.kind === "text"),
          (segment) => segment.direction
        )
      ).toEqual(["rtl", "ltr"])
    }))

  it.effect("compiles walker runtime tables alongside the prepared manual surface", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepareWithSegments({
        text: "alpha\nbeta",
        font: { family: "Mono", size: 10 },
        whiteSpace: "pre-wrap"
      }).pipe(Effect.provide(layer))

      const core = preparedTextWithSegmentsCore(prepared)

      expect(core.kernel.runtime.breakKinds.length).toBe(core.logicalSurface.segments.length)
      expect(core.kernel.runtime.fitAdvances.length).toBe(core.logicalSurface.segments.length)
      expect(core.kernel.runtime.paintAdvances.length).toBe(core.logicalSurface.segments.length)
      expect(core.kernel.runtime.breakablePrefixWidths.length).toBe(core.logicalSurface.segments.length)
      expect(core.kernel.runtime.graphemeBidiLevels.length).toBe(core.logicalSurface.segments.length)
      expect(core.kernel.runtime.mirroredGraphemes.length).toBe(core.logicalSurface.segments.length)
      expect(core.kernel.runtime.chunkStartIndices).toEqual([0, 2])
      expect(core.kernel.runtime.chunkConsumedEndIndices).toEqual([2, 3])
      expect(core.kernel.runtime.tabStopAdvance).toBe(0)
    }))

  it.effect("keeps summary handles storage-distinct from materializing handles", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const input: Text.PrepareInputType = {
        text: "alpha beta gamma",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }
      const summaryPrepared = yield* Text.prepare(input).pipe(Effect.provide(layer))
      const materializedPrepared = yield* Text.prepareWithSegments(input).pipe(Effect.provide(layer))
      const summaryCore = preparedTextCore(summaryPrepared)
      const materializedCore = preparedTextWithSegmentsCore(materializedPrepared)
      const request = { maxWidth: 40, lineHeight: 12 }

      expect(Object.prototype.hasOwnProperty.call(summaryCore, "logicalSurface")).toBe(false)
      expect(Object.prototype.hasOwnProperty.call(materializedCore, "logicalSurface")).toBe(true)
      expect(Text.layout(summaryPrepared, request)).toEqual(Text.layout(materializedPrepared, request))
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
      expect(lines).toEqual([])
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
      expect(lines).toEqual([visualLine(0, "x", 5)])
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
      expect(lines).toEqual([])
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
      expect(lines.length).toBe(3)
      expect(Arr.map(lines, (line) => line.text)).toEqual(["ab", "cd", "ef"])
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
      expect(lines.length).toBe(1)
      expect(lines[0]!.text).toBe("abcd efgh")
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
      expect(lines.length).toBe(1)
      expect(lines[0]!.text).toBe("a   b")
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
      expect(lines.length).toBe(3)
      expect(Arr.map(lines, (line) => line.text)).toEqual(["a", "", "b"])
    }))

  it.effect("font weight defaults to 400 when omitted", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepareWithSegments({
        text: "hello",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))

      const core = preparedTextWithSegmentsCore(prepared)
      expect(core.meta.font.weight).toBe(400)
    }))

  it.effect("accepts explicit font weight in prepare input", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepareWithSegments({
        text: "hello",
        font: { family: "Mono", size: 10, weight: 700 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))

      const core = preparedTextWithSegmentsCore(prepared)
      expect(core.meta.font.weight).toBe(700)
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
        expect(line.width).toBeLessThanOrEqual(request.maxWidth + 0.01)
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

      expect(projected.length).toBeGreaterThan(uniform.length)
      Arr.forEach(projected, (line) => {
        const maxWidth = maxWidthAtLine(line.index)
        expect(line.width).toBeLessThanOrEqual(maxWidth + 0.01)
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

      expect(Arr.map(lines, (line) => line.text)).toEqual(["alpha", "beta", "gamma"])
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

      expect(ranges[0]?.start).toEqual(Text.initialCursor())
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

  it.effect("keeps cursor optimization hints non-enumerable and scoped to prepared width", () =>
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
        onSome: ([, cursor]) => cursor
      })
      const plainCursor = {
        graphemeIndex: hintedCursor.graphemeIndex,
        segmentIndex: hintedCursor.segmentIndex
      }

      expect(Arr.sort(Record.keys(hintedCursor), Order.string)).toEqual(["graphemeIndex", "segmentIndex"])
      expect(Object.getOwnPropertySymbols(hintedCursor)).toEqual([])
      expect({ ...hintedCursor }).toEqual(plainCursor)
      expect(
        Option.map(Text.layoutNextLine(prepared, wideRequest, hintedCursor), ([line]) => line.index)
      ).toEqual(
        Option.map(Text.layoutNextLine(prepared, wideRequest, plainCursor), ([line]) => line.index)
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
      ): ReadonlyArray<Text.LayoutLineType> =>
        Option.match(Text.layoutNextLine(prepared, request, cursor), {
          onNone: () => [],
          onSome: ([line, nextCursor]) => [line, ...collectCursorLines(nextCursor)]
        })

      const cursorLines = collectCursorLines(Text.initialCursor())

      expect(cursorLines).toEqual(directLines)
    }))

  it.effect("walks many hard-break chunks without recursive overflow", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const text = Arr.makeBy(1500, (index) => `line-${index}`).join("\n")
      const prepared = yield* Text.prepareWithSegments({
        text,
        font: { family: "Mono", size: 10 },
        whiteSpace: "pre-wrap"
      }).pipe(Effect.provide(layer))
      const lines = Text.layoutLines(prepared, { maxWidth: 300, lineHeight: 12 })

      expect(lines.length).toBe(1500)
      expect(lines[0]?.text).toBe("line-0")
      expect(lines[1499]?.text).toBe("line-1499")
    }))
})
