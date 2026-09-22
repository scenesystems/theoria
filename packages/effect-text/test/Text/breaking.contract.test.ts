import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Match, Number, String } from "effect"
import * as Arr from "effect/Array"

import * as MeasurementCache from "../../src/MeasurementCache.js"
import * as Text from "../../src/Text.js"
import * as TextMeasurer from "../../src/TextMeasurer.js"

const visualLine = (index: number, text: string, width: number): Text.Line => ({
  baseDirection: "ltr",
  index,
  order: "visual",
  text,
  width
})

const makeTestLayer = Layer.mergeAll(
  Text.layerSegmenter,
  Text.layerProfile,
  MeasurementCache.layer.pipe(
    Layer.provide(
      Layer.succeed(TextMeasurer.TextMeasurer, {
        measure: (_font, text: string) => Effect.succeed(Number.multiply(String.length(text), 5))
      })
    )
  )
)

describe("Text breaking contracts", () => {
  it.effect("breaks overlong runs at grapheme boundaries when maxWidth is narrower than the token", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "alphabet",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(makeTestLayer))

      const lines = Text.lines(prepared, { maxWidth: 12, lineHeight: 12 })

      expect(Arr.map(lines, (line) => line.text)).toEqual(Arr.make("al", "ph", "ab", "et"))
      expect(Arr.every(lines, (line) => Number.lessThanOrEqualTo(line.width, 12.01))).toBe(true)
    }))

  it.effect("prefers soft-hyphen discretionary breaks before grapheme fallback when both fit", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "alpha\u00adbeta",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(makeTestLayer))

      expect(Text.lines(prepared, { maxWidth: 30, lineHeight: 12 })).toEqual(Arr.make(
        visualLine(0, "alpha-", 30),
        visualLine(1, "beta", 20)
      ))
    }))

  it.effect("prefers explicit zero-width break opportunities before grapheme fallback", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "alpha\u200bbeta",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(makeTestLayer))

      expect(Text.lines(prepared, { maxWidth: 30, lineHeight: 12 })).toEqual(Arr.make(
        visualLine(0, "alpha", 25),
        visualLine(1, "beta", 20)
      ))
    }))

  it.effect("keeps punctuation ownership when an attached run falls back to grapheme breaks", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "(hello) world",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(makeTestLayer))

      expect(Arr.map(Text.lines(prepared, { maxWidth: 20, lineHeight: 12 }), (line) => line.text)).toEqual(
        Arr.make("(hel", "lo)", "worl", "d")
      )
    }))

  it.effect("keeps tab advancement as layout-time arithmetic after grapheme fallback support is added", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "alphabet\na\tb",
        font: { family: "Mono", size: 10 },
        whiteSpace: "pre-wrap"
      }).pipe(Effect.provide(makeTestLayer))

      expect(Text.lines(prepared, { maxWidth: 30, lineHeight: 12 })).toEqual(Arr.make(
        visualLine(0, "alphab", 30),
        visualLine(1, "et", 10),
        visualLine(2, "a\tb", 25)
      ))
    }))

  it.effect("aligns fractional tabs independently when kerning separates fit and paint widths", () =>
    Effect.gen(function*() {
      const measurer = Layer.succeed(TextMeasurer.TextMeasurer, {
        measure: (_font, text: string) =>
          Effect.succeed(
            Match.value(text).pipe(
              Match.when(" ", () => 5.125),
              Match.when("ab", () => 14),
              Match.orElse((value) => Number.multiply(String.length(value), 7.25))
            )
          )
      })
      const prepared = yield* Text.prepareWithSegments({
        text: "ab\tc",
        font: { family: "Mono", size: 10 },
        whiteSpace: "pre-wrap"
      }).pipe(Effect.provide(Layer.mergeAll(
        Text.layerSegmenter,
        Text.layerProfile,
        MeasurementCache.layer.pipe(Layer.provide(measurer))
      )))

      // The tab stop is 20.5. Kerning gives fit width 14 but paint width 14.5;
      // their advances must differ so both reach the same stop before c.
      expect(Text.lines(prepared, { maxWidth: 27.75, lineHeight: 12 })).toEqual(Arr.of(
        visualLine(0, "ab\tc", 27.75)
      ))
      expect(Text.naturalWidth(prepared)).toBe(27.75)
      // Pre-wrap carries pending whitespace to the continuation line; its
      // tab is now measured from zero rather than the previous line's end.
      expect(Text.lines(prepared, { maxWidth: 27.7, lineHeight: 12 })).toEqual(Arr.make(
        visualLine(0, "ab", 14.5),
        visualLine(1, "\tc", 27.75)
      ))
    }))

  it.effect("advances fractional tabs at exact stops and on both neighboring sides", () =>
    Effect.gen(function*() {
      const measurer = Layer.succeed(TextMeasurer.TextMeasurer, {
        measure: (_font, text: string) =>
          Effect.succeed(
            Match.value(text).pipe(
              Match.when(" ", () => 5.125),
              Match.when("a", () => 20.499999999999996),
              Match.when("c", () => 20.5),
              Match.when("e", () => 20.500000000000004),
              Match.orElse(() => 1)
            )
          )
      })
      const prepared = yield* Text.prepareWithSegments({
        text: "a\tb\nc\td\ne\tf",
        font: { family: "Mono", size: 10 },
        whiteSpace: "pre-wrap"
      }).pipe(Effect.provide(Layer.mergeAll(
        Text.layerSegmenter,
        Text.layerProfile,
        MeasurementCache.layer.pipe(Layer.provide(measurer))
      )))

      expect(Text.lines(prepared, { maxWidth: 100, lineHeight: 12 })).toEqual(Arr.make(
        visualLine(0, "a\tb", 21.5),
        visualLine(1, "c\td", 42),
        visualLine(2, "e\tf", 42)
      ))
    }))

  it.effect("does not skip a fractional tab stop when division rounds up below it", () =>
    Effect.gen(function*() {
      const measurer = Layer.succeed(TextMeasurer.TextMeasurer, {
        measure: (_font, text: string) =>
          Effect.succeed(
            Match.value(text).pipe(
              Match.when(" ", () => 24.88250064070176),
              Match.when("a", () => 922245.00374697),
              Match.orElse(() => 1)
            )
          )
      })
      const prepared = yield* Text.prepareWithSegments({
        text: "a\tb",
        font: { family: "Mono", size: 10 },
        whiteSpace: "pre-wrap"
      }).pipe(Effect.provide(Layer.mergeAll(
        Text.layerSegmenter,
        Text.layerProfile,
        MeasurementCache.layer.pipe(Layer.provide(measurer))
      )))

      expect(Text.lines(prepared, { maxWidth: 1_000_000, lineHeight: 12 })).toEqual(Arr.of(
        visualLine(0, "a\tb", 922246.0037469701)
      ))
      expect(Text.naturalWidth(prepared)).toBe(922246.0037469701)
    }))
})
