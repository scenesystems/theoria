import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import * as Arr from "effect/Array"

import { Contracts, Text } from "../../src/index.js"

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

const layoutFor = (
  text: string,
  maxWidth: number,
  disableIntlSegmenter: boolean
) => {
  const layoutEffect = Text.prepareWithSegments({
    text,
    font: { family: "Mono", size: 10 },
    whiteSpace: "normal"
  }).pipe(
    Effect.provide(makeTestLayer),
    Effect.map((prepared) => Text.layoutLines(prepared, { maxWidth, lineHeight: 12 }))
  )

  return disableIntlSegmenter ? withIntlSegmenterDisabled(layoutEffect) : layoutEffect
}

describe("Text breaking contracts", () => {
  it.effect("breaks overlong runs at grapheme boundaries when maxWidth is narrower than the token", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "alphabet",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(makeTestLayer))

      const lines = Text.layoutLines(prepared, { maxWidth: 12, lineHeight: 12 })

      expect(Arr.map(lines, (line) => line.text)).toEqual(["al", "ph", "ab", "et"])
      expect(Arr.every(lines, (line) => line.width <= 12.01)).toBe(true)
    }))

  it.effect("prefers soft-hyphen discretionary breaks before grapheme fallback when both fit", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "alpha\u00adbeta",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(makeTestLayer))

      expect(Text.layoutLines(prepared, { maxWidth: 30, lineHeight: 12 })).toEqual([
        { index: 0, text: "alpha-", width: 30 },
        { index: 1, text: "beta", width: 20 }
      ])
    }))

  it.effect("prefers explicit zero-width break opportunities before grapheme fallback", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "alpha\u200bbeta",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(makeTestLayer))

      expect(Text.layoutLines(prepared, { maxWidth: 30, lineHeight: 12 })).toEqual([
        { index: 0, text: "alpha", width: 25 },
        { index: 1, text: "beta", width: 20 }
      ])
    }))

  it.effect("native and fallback line breaking stay identical for punctuation-sensitive content", () =>
    Effect.gen(function*() {
      const text = "(hello) world"
      const native = yield* layoutFor(text, 20, false)
      const fallback = yield* layoutFor(text, 20, true)

      expect(fallback).toEqual(native)
    }))

  it.effect("keeps tab advancement as layout-time arithmetic after grapheme fallback support is added", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "alphabet\na\tb",
        font: { family: "Mono", size: 10 },
        whiteSpace: "pre-wrap"
      }).pipe(Effect.provide(makeTestLayer))

      expect(Text.layoutLines(prepared, { maxWidth: 30, lineHeight: 12 })).toEqual([
        { index: 0, text: "alphab", width: 30 },
        { index: 1, text: "et", width: 10 },
        { index: 2, text: "a\tb", width: 25 }
      ])
    }))
})
