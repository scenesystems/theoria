import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Option, Ref, Stream } from "effect"
import * as Arr from "effect/Array"

import { Browser, Contracts, Errors, Text } from "../../src/index.js"
import { preparedTextCore } from "../../src/Text/model.js"

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
      width: text === "🙂"
        ? 4
        : text === "AB"
        ? 20
        : text === "A🙂B"
        ? 22
        : text.length * 10
    }
  }
}

describe("Text operations", () => {
  it.effect("prepares once, caches repeated measurements, and keeps layout pure", () =>
    Effect.gen(function*() {
      const { measurements, layer } = yield* makeTestContext
      const prepared = yield* Text.prepare({
        text: "hello hello",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))

      const afterPrepare = yield* Ref.get(measurements)
      expect(afterPrepare).toBe(2)

      const narrow = Text.layout(prepared, { maxWidth: 40, lineHeight: 12 })
      const wide = Text.layout(prepared, { maxWidth: 100, lineHeight: 12 })
      const afterLayout = yield* Ref.get(measurements)

      expect(afterLayout).toBe(2)
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

      const prepared = yield* Text.prepare({
        text: "A🙂B",
        font: { family: "Mono", size: 12 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))

      expect(Text.layout(prepared, { maxWidth: 100, lineHeight: 12 }).maxLineWidth).toBe(32)
    }))

  it.effect("breaks on prepared soft hyphens without making layout effectful", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepare({
        text: "alpha\u00adbeta",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))

      expect(Text.layoutLines(prepared, { maxWidth: 30, lineHeight: 12 })).toEqual([
        { index: 0, text: "alpha-", width: 30 },
        { index: 1, text: "beta", width: 20 }
      ])
    }))

  it.effect("treats tabs as pure layout-time advances derived from prepared metadata", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepare({
        text: "a\tb",
        font: { family: "Mono", size: 10 },
        whiteSpace: "pre-wrap"
      }).pipe(Effect.provide(layer))

      expect(Text.layoutLines(prepared, { maxWidth: 100, lineHeight: 12 })).toEqual([
        { index: 0, text: "a\tb", width: 25 }
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

      const core = preparedTextCore(prepared)

      expect(core.baseDirection).toBe("rtl")
      expect(
        core.manualSurface.segments.filter((segment) => segment.kind === "text").map((segment) => segment.direction)
      ).toEqual(["rtl", "ltr"])
    }))
})

describe("Text edge cases and robustness", () => {
  it.effect("handles empty string input", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepare({
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
      const prepared = yield* Text.prepare({
        text: "x",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))

      const lines = Text.layoutLines(prepared, { maxWidth: 300, lineHeight: 12 })
      expect(lines).toEqual([{ index: 0, text: "x", width: 5 }])
    }))

  it.effect("handles whitespace-only input in normal mode", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepare({
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
      const prepared = yield* Text.prepare({
        text: "ab cd ef",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))

      const lines = Text.layoutLines(prepared, { maxWidth: 11, lineHeight: 12 })
      expect(lines.length).toBe(3)
      expect(lines.map((l) => l.text)).toEqual(["ab", "cd", "ef"])
    }))

  it.effect("handles text that exactly fills the line width", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepare({
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
      const prepared = yield* Text.prepare({
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
      const prepared = yield* Text.prepare({
        text: "a\n\nb",
        font: { family: "Mono", size: 10 },
        whiteSpace: "pre-wrap"
      }).pipe(Effect.provide(layer))

      const lines = Text.layoutLines(prepared, { maxWidth: 200, lineHeight: 12 })
      expect(lines.length).toBe(3)
      expect(lines.map((l) => l.text)).toEqual(["a", "", "b"])
    }))

  it.effect("font weight defaults to 400 when omitted", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepareWithSegments({
        text: "hello",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))

      const core = preparedTextCore(prepared)
      expect(core.font.weight).toBe(400)
    }))

  it.effect("accepts explicit font weight in prepare input", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepareWithSegments({
        text: "hello",
        font: { family: "Mono", size: 10, weight: 700 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))

      const core = preparedTextCore(prepared)
      expect(core.font.weight).toBe(700)
    }))

  it.effect("layout is idempotent across repeated calls", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const prepared = yield* Text.prepare({
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
      const prepared = yield* Text.prepare({
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
      const prepared = yield* Text.prepare({
        text: "The quick brown fox jumps over the lazy dog near a stream of flowing water",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))

      const request = { maxWidth: 80, lineHeight: 14 }
      const projected = Text.layoutLinesWith(
        prepared,
        request,
        (lineIndex) => lineIndex === 0 ? request.maxWidth : 40
      )
      const uniform = Text.layoutLines(prepared, request)

      expect(projected.length).toBeGreaterThan(uniform.length)
      Arr.forEach(projected, (line) => {
        const maxWidth = line.index === 0 ? request.maxWidth : 40
        expect(line.width).toBeLessThanOrEqual(maxWidth + 0.01)
      })
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
})
