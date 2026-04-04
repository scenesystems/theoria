import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Option } from "effect"
import * as Arr from "effect/Array"

import { Contracts, Text } from "../../src/index.js"
import { containsUnsupportedBidiControls } from "../../src/Text/internal/bidi.js"
import { bidiMirrorPairs } from "../../src/Text/internal/bidiData.js"

const makeTestLayer = Layer.mergeAll(
  Text.WordSegmenterLive,
  Text.EngineProfileLive,
  Text.MeasurementCacheLive.pipe(
    Layer.provide(
      Layer.succeed(Contracts.TextMeasurer, {
        measure: (_font, text: string) => Effect.succeed(text.length * 5)
      })
    )
  )
)

describe("Text bidi visual ordering contracts", () => {
  it.effect("reorders mixed RTL and LTR visual output from prepared bidi metadata", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "שלום hello مرحبا",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(makeTestLayer))

      expect(Text.layoutLines(prepared, { maxWidth: 200, lineHeight: 12 })).toEqual([
        {
          baseDirection: "rtl",
          index: 0,
          order: "visual",
          text: "ابحرم hello םולש",
          width: 80
        }
      ])
    }))

  it.effect("handles neutral punctuation in mixed-direction lines", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "hello (שלום) world",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(makeTestLayer))

      expect(Text.layoutLines(prepared, { maxWidth: 200, lineHeight: 12 })[0]?.text).toBe("hello (םולש) world")
    }))

  it.effect("mirrors paired punctuation inside rtl visual runs", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "(שלום)",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(makeTestLayer))

      expect(Text.layoutLines(prepared, { maxWidth: 200, lineHeight: 12 })[0]?.text).toBe("(םולש)")
    }))

  it.effect("keeps cursor bounds stable across visually reordered output", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "hello שלום world",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(makeTestLayer))
      const request = { maxWidth: 200, lineHeight: 12 }
      const lines = Text.layoutLines(prepared, request)
      const ranges = Text.walkLineRanges(prepared, request)
      const nextLine = Text.layoutNextLine(prepared, request, Text.initialCursor())

      expect(lines[0]?.text).toBe("hello םולש world")
      expect(ranges).toEqual([
        {
          baseDirection: "ltr",
          end: { graphemeIndex: 0, segmentIndex: 5 },
          order: "visual",
          start: { graphemeIndex: 0, segmentIndex: 0 },
          width: 80
        }
      ])
      expect(
        Option.map(nextLine, ([line, cursor]) => ({
          cursor,
          line
        }))
      ).toEqual(
        Option.some({
          cursor: { graphemeIndex: 0, segmentIndex: 5 },
          line: {
            baseDirection: "ltr",
            index: 0,
            order: "visual",
            text: "hello םולש world",
            width: 80
          }
        })
      )
    }))

  it.effect("keeps summary and manual layout surfaces aligned under bidi visual ordering", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "שלום hello مرحبا שוב",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(makeTestLayer))
      const request = { maxWidth: 55, lineHeight: 12 }
      const summary = Text.layout(prepared, request)
      const lines = Text.layoutLines(prepared, request)
      const ranges = Text.walkLineRanges(prepared, request)

      expect(summary.lineCount).toBe(lines.length)
      expect(summary.maxLineWidth).toBe(Arr.reduce(lines, 0, (maxWidth, line) => Math.max(maxWidth, line.width)))
      expect(Arr.map(ranges, (range) => range.width)).toEqual(Arr.map(lines, (line) => line.width))
      expect(Arr.every(lines, (line) => line.order === "visual")).toBe(true)
    }))

  it.effect("pins the governed mirror-table coverage for shipped paired punctuation", () =>
    Effect.sync(() => {
      expect(bidiMirrorPairs).toEqual([
        ["(", ")"],
        [")", "("],
        ["[", "]"],
        ["]", "["],
        ["{", "}"],
        ["}", "{"],
        ["<", ">"],
        [">", "<"],
        ["«", "»"],
        ["»", "«"],
        ["‹", "›"],
        ["›", "‹"],
        ["〈", "〉"],
        ["〉", "〈"],
        ["《", "》"],
        ["》", "《"],
        ["「", "」"],
        ["」", "「"],
        ["『", "』"],
        ["』", "『"],
        ["【", "】"],
        ["】", "【"],
        ["〔", "〕"],
        ["〕", "〔"],
        ["〖", "〗"],
        ["〗", "〖"],
        ["〘", "〙"],
        ["〙", "〘"],
        ["〚", "〛"],
        ["〛", "〚"],
        ["（", "）"],
        ["）", "（"],
        ["［", "］"],
        ["］", "［"],
        ["｛", "｝"],
        ["｝", "｛"]
      ])
    }))

  it.effect("treats bidi formatting controls as an explicit unsupported branch", () =>
    Effect.sync(() => {
      expect(containsUnsupportedBidiControls("abc\u2067def\u2069")).toBe(true)
      expect(containsUnsupportedBidiControls("a\u200bb\u2060c\u00add")).toBe(false)
    }))

  it.effect("handles bidi-heavy long lines without recursive overflow", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "שלום hello مرحبا ".repeat(1200).trim(),
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(makeTestLayer))
      const request = { maxWidth: 1000000, lineHeight: 12 }
      const summary = Text.layout(prepared, request)
      const lines = Text.layoutLines(prepared, request)

      expect(summary.lineCount).toBe(1)
      expect(lines.length).toBe(1)
      expect(lines[0]?.text.length).toBeGreaterThan(1000)
    }))
})
