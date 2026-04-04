import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import * as Arr from "effect/Array"
import * as Data from "effect/Data"

import { Contracts, Text } from "../../src/index.js"
import { preparedTextWithSegmentsCore } from "../../src/Text/model.js"

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

const normalCase = (text: string): { readonly text: string; readonly whiteSpace: Text.WhiteSpaceModeType } => ({
  text,
  whiteSpace: "normal"
})

const withIntlSegmenterDisabled = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const descriptor = Object.getOwnPropertyDescriptor(Intl, "Segmenter")
      Object.defineProperty(Intl, "Segmenter", {
        configurable: true,
        value: undefined,
        writable: true
      })
      return descriptor
    }),
    () => effect,
    (descriptor) =>
      Effect.sync(() => {
        if (descriptor) {
          Object.defineProperty(Intl, "Segmenter", descriptor)
        }
      })
  )

const prepareSurface = (
  text: string,
  whiteSpace: Text.WhiteSpaceModeType,
  disableIntlSegmenter: boolean
) => {
  const preparedEffect = Text.prepareWithSegments({
    text,
    font: { family: "Mono", size: 10 },
    whiteSpace
  }).pipe(
    Effect.provide(makeTestLayer),
    Effect.map((prepared) => {
      const core = preparedTextWithSegmentsCore(prepared)

      return {
        breakKinds: core.kernel.runtime.breakKinds,
        graphemeCounts: Arr.map(core.logicalSurface.segments, (segment) => segment.graphemes.length),
        segments: Arr.map(core.logicalSurface.segments, (segment) => segment.text)
      }
    })
  )

  return disableIntlSegmenter ? withIntlSegmenterDisabled(preparedEffect) : preparedEffect
}

describe("Text segmentation contracts", () => {
  it.effect("segments English whitespace and preserved hard breaks correctly", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "alpha  beta\n\ngamma\tdelta",
        font: { family: "Mono", size: 10 },
        whiteSpace: "pre-wrap"
      }).pipe(Effect.provide(makeTestLayer))

      const core = preparedTextWithSegmentsCore(prepared)

      expect(Arr.map(core.logicalSurface.segments, (segment) => Data.tuple(segment.kind, segment.text))).toEqual([
        ["text", "alpha"],
        ["space", "  "],
        ["text", "beta"],
        ["hard-break", "\n"],
        ["hard-break", "\n"],
        ["text", "gamma"],
        ["tab", "\t"],
        ["text", "delta"]
      ])
      expect(core.kernel.runtime.breakKinds).toEqual([
        "text",
        "preserved-space",
        "text",
        "hard-break",
        "hard-break",
        "text",
        "tab",
        "text"
      ])
    }))

  it.effect("segments long unbroken text into grapheme-aware fallback units", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "supercalifragilistic",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(makeTestLayer))

      const core = preparedTextWithSegmentsCore(prepared)
      const lines = Text.layoutLines(prepared, { maxWidth: 12, lineHeight: 12 })

      expect(core.kernel.runtime.breakableGraphemeWidths[0]?.length).toBeGreaterThan(1)
      expect(lines.length).toBeGreaterThan(1)
      expect(Arr.reduce(lines, "", (text, line) => text + line.text)).toBe("supercalifragilistic")
      expect(Arr.every(lines, (line) => line.width <= 12.01)).toBe(true)
    }))

  it.effect("segments CJK text without treating the whole run as one unbreakable token", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "你好世界再见",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(makeTestLayer))

      const core = preparedTextWithSegmentsCore(prepared)
      const lines = Text.layoutLines(prepared, { maxWidth: 10, lineHeight: 12 })

      expect(Arr.some(core.kernel.runtime.breakableGraphemeWidths, (widths) => widths.length > 1)).toBe(true)
      expect(lines.length).toBeGreaterThan(1)
      expect(Arr.reduce(lines, "", (text, line) => text + line.text)).toBe("你好世界再见")
      expect(Arr.every(lines, (line) => line.width <= 10.01)).toBe(true)
    }))

  it.effect("segments at least one no-space language with deterministic fallback semantics", () =>
    withIntlSegmenterDisabled(
      Effect.gen(function*() {
        const prepared = yield* Text.prepareWithSegments({
          text: "ภาษาไทยไม่มีช่องว่าง",
          font: { family: "Mono", size: 10 },
          whiteSpace: "normal"
        }).pipe(Effect.provide(makeTestLayer))

        const core = preparedTextWithSegmentsCore(prepared)
        const lines = Text.layoutLines(prepared, { maxWidth: 15, lineHeight: 12 })

        expect(core.logicalSurface.segments.length).toBeGreaterThan(1)
        expect(lines.length).toBeGreaterThan(1)
        expect(Arr.reduce(lines, "", (text, line) => text + line.text)).toBe("ภาษาไทยไม่มีช่องว่าง")
      })
    ))

  it.effect("fallback and native analysis expose the same released break surface for representative corpora", () =>
    Effect.gen(function*() {
      const cases = [
        normalCase("ภาษาไทยไม่มีช่องว่าง"),
        normalCase("(hello) world"),
        normalCase("https://example.com/a-b?x=1,2"),
        normalCase("no\u00a0break word\u2060join a\u200bb")
      ]

      const results = yield* Effect.forEach(cases, (item) =>
        Effect.all({
          fallback: prepareSurface(item.text, item.whiteSpace, true),
          native: prepareSurface(item.text, item.whiteSpace, false)
        }).pipe(
          Effect.map((result) => ({
            ...result,
            text: item.text
          }))
        ))

      Arr.forEach(results, (result) => {
        expect(result.fallback).toEqual(result.native)
      })
    }))

  it.effect("preserves tabs, hard breaks, soft hyphens, emoji clusters, and glue characters through prepare", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "A\tB\nC\u00adD 👨‍👩‍👧‍👦 no\u00a0break",
        font: { family: "Mono", size: 10 },
        whiteSpace: "pre-wrap"
      }).pipe(Effect.provide(makeTestLayer))

      const core = preparedTextWithSegmentsCore(prepared)

      expect(Arr.some(core.logicalSurface.segments, (segment) => segment.kind === "tab" && segment.text === "\t")).toBe(
        true
      )
      expect(Arr.some(core.logicalSurface.segments, (segment) => segment.kind === "hard-break")).toBe(true)
      expect(Arr.some(core.logicalSurface.segments, (segment) => segment.breakOpportunity === "soft-hyphen")).toBe(true)
      expect(
        Arr.some(
          core.logicalSurface.segments,
          (segment) => segment.kind === "text" && segment.graphemes.includes("👨‍👩‍👧‍👦")
        )
      ).toBe(true)
      expect(Arr.some(core.logicalSurface.segments, (segment) => segment.text.includes("\u00a0"))).toBe(true)
    }))

  it.effect("compiles NBSP, WJ, and ZWSP into explicit runtime break kinds instead of hiding them inside generic text runs", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "no\u00a0break word\u2060join a\u200bb",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(makeTestLayer))

      const core = preparedTextWithSegmentsCore(prepared)

      expect(Arr.map(core.logicalSurface.segments, (segment) => segment.text)).toEqual([
        "no",
        "\u00a0",
        "break",
        " ",
        "word",
        "\u2060",
        "join",
        " ",
        "a",
        "\u200b",
        "b"
      ])
      expect(core.kernel.runtime.breakKinds).toEqual([
        "text",
        "glue",
        "text",
        "space",
        "text",
        "glue",
        "text",
        "space",
        "text",
        "zero-width-break",
        "text"
      ])
    }))

  it.effect("stores mixed RTL and LTR metadata that the visual-order layout plane reuses", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "שלום hello مرحبا",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(makeTestLayer))

      const core = preparedTextWithSegmentsCore(prepared)
      const lines = Text.layoutLines(prepared, { maxWidth: 200, lineHeight: 12 })

      expect(core.kernel.baseDirection).toBe("rtl")
      expect(
        Arr.map(
          Arr.filter(core.logicalSurface.segments, (segment) => segment.kind === "text"),
          (segment) => segment.direction
        )
      ).toEqual(["rtl", "ltr", "rtl"])
      expect(lines[0]?.text).toBe("ابحرم hello םולש")
    }))
})
