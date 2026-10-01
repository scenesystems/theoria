import { describe, expect, it } from "@effect/vitest"
import { Effect, FastCheck, Layer, Number, String, Tuple } from "effect"
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
  it.effect.prop(
    "grapheme cursor widths preserve every character on both sides of a line-fit boundary",
    Tuple.make(
      FastCheck.array(FastCheck.constantFrom("a", "b", "c"), { minLength: 1, maxLength: 80 }),
      FastCheck.integer({ min: 2, max: 9 })
    ),
    ([characters, slots]) =>
      Effect.gen(function*() {
        const prepared = yield* Text.prepareWithSegments({
          text: Arr.join(characters, ""),
          font: { family: "Mono", size: 10 },
          whiteSpace: "normal"
        }).pipe(Effect.provide(makeTestLayer))
        const expected = (count: number) =>
          Arr.map(Arr.chunksOf(characters, count), (part, index) =>
            visualLine(index, Arr.join(part, ""), Number.multiply(Arr.length(part), 5)))
        expect(Text.lines(prepared, { maxWidth: Number.multiply(slots, 5), lineHeight: 12 }))
          .toEqual(expected(slots))
        expect(Text.lines(prepared, { maxWidth: Number.subtract(Number.multiply(slots, 5), 0.1), lineHeight: 12 }))
          .toEqual(expected(Number.decrement(slots)))
      })
  )

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
})
