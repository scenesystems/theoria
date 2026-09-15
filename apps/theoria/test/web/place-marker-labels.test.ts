import { describe, expect, it } from "@effect/vitest"
import { Contracts, Text } from "@scenesystems/effect-text"
import { Effect, Layer, Number, Option, String } from "effect"

import { labelWidthFor } from "../../app/web/view/home/placeMarkerLabels.js"

const layoutLayer = Layer.mergeAll(
  Text.WordSegmenterLive,
  Text.EngineProfileLive,
  Text.MeasurementCacheLive.pipe(Layer.provide(Layer.succeed(Contracts.TextMeasurer, {
    measure: (_font, text) => Effect.succeed(Number.multiply(String.length(text), 48))
  })))
)

describe("marker label fitting", () => {
  it.effect("includes a rectangle exactly on the inset circle and rejects one just outside", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "W",
        font: { family: "Mono", size: 12 },
        whiteSpace: "normal"
      })
      // A 48 × 14 label has diagonal 50. The two 6px insets require diameter 62.
      expect(labelWidthFor(prepared, "W", 62)).toEqual(Option.some(50))
      expect(labelWidthFor(prepared, "W", 61.99)).toEqual(Option.none())
      expect(labelWidthFor(prepared, "W", 12)).toEqual(Option.none())
    }).pipe(Effect.provide(layoutLayer)))

  it.effect("declines a name that fits only by breaking inside a word", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "WW",
        font: { family: "Mono", size: 12 },
        whiteSpace: "normal"
      })
      // Two 48px lines would fit inside the 68px inset diameter, but split WW.
      expect(labelWidthFor(prepared, "WW", 80)).toEqual(Option.none())
    }).pipe(Effect.provide(layoutLayer)))
})
