import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Number, Option, String, Tuple } from "effect"
import * as Arr from "effect/Array"

import { Contracts, Text } from "../../src/index.js"

const makeTestLayer = Layer.mergeAll(
  Text.WordSegmenterLive,
  Text.EngineProfileLive,
  Text.MeasurementCacheLive.pipe(
    Layer.provide(
      Layer.succeed(Contracts.TextMeasurer, {
        measure: (_font, text: string) => Effect.succeed(Number.multiply(String.length(text), 5))
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

      expect(Text.layoutLines(prepared, { maxWidth: 200, lineHeight: 12 })).toEqual(Arr.of(
        {
          baseDirection: "rtl",
          index: 0,
          order: "visual",
          text: "ابحرم hello םולש",
          width: 80
        }
      ))
    }))

  it.effect("handles neutral punctuation in mixed-direction lines", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "hello (שלום) world",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(makeTestLayer))

      expect(
        Arr.head(Text.layoutLines(prepared, { maxWidth: 200, lineHeight: 12 })).pipe(Option.map((line) => line.text))
      )
        .toEqual(Option.some("hello (םולש) world"))
    }))

  it.effect("mirrors paired punctuation inside rtl visual runs", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "(שלום)",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(makeTestLayer))

      expect(
        Arr.head(Text.layoutLines(prepared, { maxWidth: 200, lineHeight: 12 })).pipe(Option.map((line) => line.text))
      )
        .toEqual(Option.some("(םולש)"))
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

      expect(Arr.head(lines).pipe(Option.map((line) => line.text))).toEqual(Option.some("hello םולש world"))
      expect(ranges).toEqual(Arr.of(
        {
          baseDirection: "ltr",
          end: { graphemeIndex: 0, segmentIndex: 5 },
          order: "visual",
          start: { graphemeIndex: 0, segmentIndex: 0 },
          width: 80
        }
      ))
      expect(
        Option.map(nextLine, (step) => ({
          cursor: Tuple.getSecond(step),
          line: Tuple.getFirst(step)
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

      expect(summary.lineCount).toBe(Arr.length(lines))
      expect(summary.maxLineWidth).toBe(Arr.reduce(lines, 0, (maxWidth, line) => Number.max(maxWidth, line.width)))
      expect(Arr.map(ranges, (range) => range.width)).toEqual(Arr.map(lines, (line) => line.width))
      expect(Arr.every(lines, (line) => String.Equivalence(line.order, "visual"))).toBe(true)
    }))

  it.effect("preserves unsupported bidi formatting controls instead of interpreting or dropping them", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "abc\u2067def\u2069",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(makeTestLayer))

      expect(Text.layoutLines(prepared, { maxWidth: 200, lineHeight: 12 })).toEqual(Arr.of(
        {
          baseDirection: "ltr",
          index: 0,
          order: "visual",
          text: "abc\u2067def\u2069",
          width: 40
        }
      ))
    }))

  it.effect("handles bidi-heavy long lines without recursive overflow", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: String.trim(Arr.join(Arr.replicate("שלום hello مرحبا ", 1200), "")),
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(makeTestLayer))
      const request = { maxWidth: 1000000, lineHeight: 12 }
      const summary = Text.layout(prepared, request)
      const lines = Text.layoutLines(prepared, request)

      expect(summary.lineCount).toBe(1)
      expect(Arr.length(lines)).toBe(1)
      expect(Arr.head(lines).pipe(Option.map((line) => String.length(line.text)))).toEqual(Option.some(20399))
    }))
})
