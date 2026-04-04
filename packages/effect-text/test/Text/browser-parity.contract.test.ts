import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import * as Arr from "effect/Array"

import { Browser, Text } from "../../src/index.js"

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

class BrowserParityCanvasContext {
  direction: "ltr" | "rtl" | "inherit" = "inherit"
  font = "10px monospace"
  textBaseline: "top" | "hanging" | "middle" | "alphabetic" | "ideographic" | "bottom" = "alphabetic"

  measureText(text: string): { readonly width: number } {
    return { width: text.length * 10 }
  }
}

const browserLayer = () =>
  Layer.mergeAll(
    Text.WordSegmenterLive,
    Text.EngineProfileLive,
    Text.MeasurementCacheLive.pipe(
      Layer.provide(
        Browser.CanvasTextMeasurerLive({
          context: new BrowserParityCanvasContext()
        })
      )
    )
  )

const widestLineWidth = (lines: ReadonlyArray<Text.LayoutLineType>): number =>
  Arr.reduce(lines, 0, (widest, line) => (line.width > widest ? line.width : widest))

const expectSummaryToMatchLines = (
  summary: Text.LayoutSummaryType,
  lines: ReadonlyArray<Text.LayoutLineType>,
  lineHeight: number
) => {
  expect(summary.lineCount).toBe(lines.length)
  expect(summary.height).toBe(lines.length * lineHeight)
  expect(summary.maxLineWidth).toBe(widestLineWidth(lines))
}

describe("Text browser parity contracts", () => {
  it.effect("matches browser layout for white-space normal", () =>
    Effect.gen(function*() {
      const request = { maxWidth: 100, lineHeight: 12 }
      const prepared = yield* Text.prepareWithSegments({
        text: "alpha beta gamma",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(browserLayer()))
      const lines = Text.layoutLines(prepared, request)

      expect(lines).toEqual([
        visualLine(0, "alpha beta", 100),
        visualLine(1, "gamma", 50)
      ])
      expectSummaryToMatchLines(Text.layout(prepared, request), lines, request.lineHeight)
    }))

  it.effect("matches browser layout for white-space pre-wrap", () =>
    Effect.gen(function*() {
      const request = { maxWidth: 200, lineHeight: 12 }
      const prepared = yield* Text.prepareWithSegments({
        text: "alpha  beta",
        font: { family: "Mono", size: 10 },
        whiteSpace: "pre-wrap"
      }).pipe(Effect.provide(browserLayer()))
      const lines = Text.layoutLines(prepared, request)

      expect(lines).toEqual([visualLine(0, "alpha  beta", 110)])
      expectSummaryToMatchLines(Text.layout(prepared, request), lines, request.lineHeight)
    }))

  it.effect("matches browser behavior for trailing whitespace and hard breaks", () =>
    Effect.gen(function*() {
      const request = { maxWidth: 200, lineHeight: 12 }
      const prepared = yield* Text.prepareWithSegments({
        text: "alpha  \nbeta",
        font: { family: "Mono", size: 10 },
        whiteSpace: "pre-wrap"
      }).pipe(Effect.provide(browserLayer()))
      const lines = Text.layoutLines(prepared, request)

      expect(lines).toEqual([
        visualLine(0, "alpha  ", 70),
        visualLine(1, "beta", 40)
      ])
      expectSummaryToMatchLines(Text.layout(prepared, request), lines, request.lineHeight)
    }))

  it.effect("matches browser tab advances", () =>
    Effect.gen(function*() {
      const request = { maxWidth: 100, lineHeight: 12 }
      const prepared = yield* Text.prepareWithSegments({
        text: "a\tb",
        font: { family: "Mono", size: 10 },
        whiteSpace: "pre-wrap"
      }).pipe(Effect.provide(browserLayer()))
      const lines = Text.layoutLines(prepared, request)

      expect(lines).toEqual([visualLine(0, "a\tb", 50)])
      expectSummaryToMatchLines(Text.layout(prepared, request), lines, request.lineHeight)
    }))

  it.effect("matches browser soft-hyphen behavior", () =>
    Effect.gen(function*() {
      const request = { maxWidth: 60, lineHeight: 12 }
      const prepared = yield* Text.prepareWithSegments({
        text: "alpha\u00adbeta",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(browserLayer()))
      const lines = Text.layoutLines(prepared, request)

      expect(lines).toEqual([
        visualLine(0, "alpha-", 60),
        visualLine(1, "beta", 40)
      ])
      expectSummaryToMatchLines(Text.layout(prepared, request), lines, request.lineHeight)
    }))

  it.effect("matches browser punctuation and mixed inline cases for the v0.2 browser profile set", () =>
    Effect.gen(function*() {
      const request = { maxWidth: 200, lineHeight: 12 }
      const prepared = yield* Text.prepareWithSegments({
        text: "(שלום) hello",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(browserLayer()))
      const lines = Text.layoutLines(prepared, request)

      expect(lines).toEqual([visualLine(0, "hello (םולש)", 120, "rtl")])
      expectSummaryToMatchLines(Text.layout(prepared, request), lines, request.lineHeight)
    }))
})
