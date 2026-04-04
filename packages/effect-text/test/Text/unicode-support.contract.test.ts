import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import * as Arr from "effect/Array"

import { Contracts, Text } from "../../src/index.js"
import { preparedTextWithSegmentsCore } from "../../src/Text/model.js"
import { unicodeOverflowFixtures, unicodeSegmentationFixtures } from "../fixtures/unicodeSupport.js"

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

const visibleText = (text: string): string => text.replace(/\u200b/gu, "")
const normalizedVisibleText = (text: string): string => visibleText(text).replace(/ /gu, "")

describe("Text unicode support fixtures", () => {
  it.effect("matches the checked-in segmentation fixtures for the released unicode support envelope", () =>
    Effect.forEach(
      unicodeSegmentationFixtures,
      (fixture) =>
        Text.prepareWithSegments({
          text: fixture.text,
          font: { family: "Mono", size: 10 },
          whiteSpace: fixture.whiteSpace
        }).pipe(
          Effect.provide(makeTestLayer),
          Effect.map((prepared) => {
            const core = preparedTextWithSegmentsCore(prepared)

            expect(Arr.map(core.logicalSurface.segments, (segment) => segment.text), fixture.name).toEqual(
              fixture.expectedSegments
            )
            expect(core.kernel.runtime.breakKinds, fixture.name).toEqual(fixture.expectedBreakKinds)
          })
        ),
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
            const lines = Text.layoutLines(prepared, { maxWidth: fixture.maxWidth, lineHeight: 12 })

            expect(normalizedVisibleText(Arr.reduce(lines, "", (text, line) => text + line.text)), fixture.name).toBe(
              normalizedVisibleText(fixture.text)
            )
            expect(Arr.every(lines, (line) => line.width <= fixture.maxWidth + 0.01), fixture.name).toBe(true)
          })
        ),
      { discard: true }
    ))

  it.effect("only emits overwide lines when a single grapheme itself exceeds maxWidth", () =>
    Effect.gen(function*() {
      const oversizedLayer = Layer.mergeAll(
        Text.WordSegmenterLive,
        Text.EngineProfileLive,
        Text.MeasurementCacheLive.pipe(
          Layer.provide(
            Layer.succeed(Contracts.TextMeasurer, {
              measure: (_font, text: string) => Effect.succeed(/^W+$/u.test(text) ? text.length * 40 : text.length * 5)
            })
          )
        )
      )

      const prepared = yield* Text.prepareWithSegments({
        text: "WW",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(oversizedLayer))

      expect(Text.layoutLines(prepared, { maxWidth: 20, lineHeight: 12 })).toEqual([
        { baseDirection: "ltr", index: 0, order: "visual", text: "W", width: 40 },
        { baseDirection: "ltr", index: 1, order: "visual", text: "W", width: 40 }
      ])
    }))
})
