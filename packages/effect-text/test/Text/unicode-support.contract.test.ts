import { describe, expect, it } from "@effect/vitest"
import { Boolean, Effect, Layer, Number, Schema, String } from "effect"
import * as Arr from "effect/Array"

import * as MeasurementCache from "../../src/MeasurementCache.js"
import * as Text from "../../src/Text.js"
import * as TextMeasurer from "../../src/TextMeasurer.js"
import { unicodeOverflowFixtures, unicodeSegmentationFixtures } from "../fixtures/unicodeSupport.js"

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

const visibleText = (text: string): string => String.replace(/\u200b/gu, "")(text)
const normalizedVisibleText = (text: string): string => String.replace(/ /gu, "")(visibleText(text))
const isWideText = Schema.is(Schema.String.pipe(Schema.pattern(/^W+$/u)))

describe("Text unicode support fixtures", () => {
  it.effect("matches explicit segmentation results through the public Segmenter contract", () =>
    Effect.forEach(
      unicodeSegmentationFixtures,
      (fixture) =>
        Effect.gen(function*() {
          const segmenter = yield* Text.Segmenter
          expect(yield* segmenter.segment(fixture.text, fixture.whiteSpace), fixture.name).toEqual(fixture.expected)
        }).pipe(Effect.provide(Text.layerSegmenter)),
      { discard: true }
    ))

  it.effect("keeps fixture-backed support cases within maxWidth whenever the overflow policy has a legal break", () =>
    Effect.forEach(
      unicodeOverflowFixtures,
      (fixture) =>
        Text.prepareWithSegments({
          text: fixture.text,
          font: { family: "Mono", size: 10 },
          whiteSpace: "normal"
        }).pipe(
          Effect.provide(makeTestLayer),
          Effect.map((prepared) => {
            const lines = Text.lines(prepared, { maxWidth: fixture.maxWidth, lineHeight: 12 })

            expect(
              normalizedVisibleText(Arr.reduce(lines, "", (text, line) => String.concat(line.text)(text))),
              fixture.name
            ).toBe(normalizedVisibleText(fixture.text))
            expect(
              Arr.every(lines, (line) => Number.lessThanOrEqualTo(line.width, Number.sum(fixture.maxWidth, 0.01))),
              fixture.name
            ).toBe(true)
          })
        ),
      { discard: true }
    ))

  it.effect("only emits overwide lines when a single grapheme itself exceeds maxWidth", () =>
    Effect.gen(function*() {
      const oversizedLayer = Layer.mergeAll(
        Text.layerSegmenter,
        Text.layerProfile,
        MeasurementCache.layer.pipe(
          Layer.provide(
            Layer.succeed(TextMeasurer.TextMeasurer, {
              measure: (_font, text: string) =>
                Effect.succeed(
                  Number.multiply(
                    String.length(text),
                    Boolean.match(isWideText(text), { onFalse: () => 5, onTrue: () => 40 })
                  )
                )
            })
          )
        )
      )

      const prepared = yield* Text.prepareWithSegments({
        text: "WW",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(oversizedLayer))

      expect(Text.lines(prepared, { maxWidth: 20, lineHeight: 12 })).toEqual(Arr.make(
        { baseDirection: "ltr", index: 0, order: "visual", text: "W", width: 40 },
        { baseDirection: "ltr", index: 1, order: "visual", text: "W", width: 40 }
      ))
    }))
})
