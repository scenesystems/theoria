import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer } from "effect"

import { Contracts, Text } from "../../src/index.js"
import { preparedTextCore } from "../../src/Text/model.js"

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

describe("Text segmentation contracts", () => {
  it.effect("segments English whitespace and preserved hard breaks correctly", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "alpha  beta\n\ngamma\tdelta",
        font: { family: "Mono", size: 10 },
        whiteSpace: "pre-wrap"
      }).pipe(Effect.provide(makeTestLayer))

      const core = preparedTextCore(prepared)

      expect(core.manualSurface.segments.map((segment) => [segment.kind, segment.text])).toEqual([
        ["text", "alpha"],
        ["space", "  "],
        ["text", "beta"],
        ["hard-break", "\n"],
        ["hard-break", "\n"],
        ["text", "gamma"],
        ["tab", "\t"],
        ["text", "delta"]
      ])
      expect(core.runtime.breakKinds).toEqual([
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

      const core = preparedTextCore(prepared)
      const lines = Text.layoutLines(prepared, { maxWidth: 12, lineHeight: 12 })

      expect(core.runtime.breakableGraphemeWidths[0]?.length).toBeGreaterThan(1)
      expect(lines.length).toBeGreaterThan(1)
      expect(lines.map((line) => line.text).join("")).toBe("supercalifragilistic")
      expect(lines.every((line) => line.width <= 12.01)).toBe(true)
    }))

  it.effect("segments CJK text without treating the whole run as one unbreakable token", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "你好世界再见",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(makeTestLayer))

      const core = preparedTextCore(prepared)
      const lines = Text.layoutLines(prepared, { maxWidth: 10, lineHeight: 12 })

      expect(core.runtime.breakableGraphemeWidths.some((widths) => widths.length > 1)).toBe(true)
      expect(lines.length).toBeGreaterThan(1)
      expect(lines.map((line) => line.text).join("")).toBe("你好世界再见")
      expect(lines.every((line) => line.width <= 10.01)).toBe(true)
    }))

  it.effect("segments at least one no-space language with deterministic fallback semantics", () =>
    withIntlSegmenterDisabled(
      Effect.gen(function*() {
        const prepared = yield* Text.prepareWithSegments({
          text: "ภาษาไทยไม่มีช่องว่าง",
          font: { family: "Mono", size: 10 },
          whiteSpace: "normal"
        }).pipe(Effect.provide(makeTestLayer))

        const core = preparedTextCore(prepared)
        const lines = Text.layoutLines(prepared, { maxWidth: 15, lineHeight: 12 })

        expect(core.manualSurface.segments.length).toBeGreaterThan(1)
        expect(lines.length).toBeGreaterThan(1)
        expect(lines.map((line) => line.text).join("")).toBe("ภาษาไทยไม่มีช่องว่าง")
      })
    ))

  it.effect("preserves tabs, hard breaks, soft hyphens, emoji clusters, and glue characters through prepare", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "A\tB\nC\u00adD 👨‍👩‍👧‍👦 no\u00a0break",
        font: { family: "Mono", size: 10 },
        whiteSpace: "pre-wrap"
      }).pipe(Effect.provide(makeTestLayer))

      const core = preparedTextCore(prepared)

      expect(core.manualSurface.segments.some((segment) => segment.kind === "tab" && segment.text === "\t")).toBe(true)
      expect(core.manualSurface.segments.some((segment) => segment.kind === "hard-break")).toBe(true)
      expect(core.manualSurface.segments.some((segment) => segment.breakOpportunity === "soft-hyphen")).toBe(true)
      expect(
        core.manualSurface.segments.some((segment) => segment.kind === "text" && segment.graphemes.includes("👨‍👩‍👧‍👦"))
      ).toBe(true)
      expect(core.manualSurface.segments.some((segment) => segment.text.includes("\u00a0"))).toBe(true)
    }))

  it.effect("stores mixed RTL and LTR metadata without claiming visual reorder yet", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "שלום hello مرحبا",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(makeTestLayer))

      const core = preparedTextCore(prepared)
      const lines = Text.layoutLines(prepared, { maxWidth: 200, lineHeight: 12 })

      expect(core.baseDirection).toBe("rtl")
      expect(
        core.manualSurface.segments.filter((segment) => segment.kind === "text").map((segment) => segment.direction)
      ).toEqual(["rtl", "ltr", "rtl"])
      expect(lines[0]?.text).toBe("שלום hello مرحبا")
    }))
})
