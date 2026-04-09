import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Ref } from "effect"
import { Text } from "effect-text"
import * as Contracts from "effect-text/contracts"

import { corpus } from "../../app/contracts/corpus.js"
import { fontDescriptorFor, semanticsFor } from "../../app/contracts/presentation/text.js"
import { projectReflowProjection } from "../../app/web/atoms/reflow.js"
import { projectObstacleTextLayout } from "../../app/web/text/obstacleProjection.js"

const reflowFont = fontDescriptorFor(semanticsFor("card-summary"))

const countingBrowserlessLayer = (measureCalls: Ref.Ref<number>) => {
  const measurer = Layer.succeed(Contracts.TextMeasurer, {
    measure: (font: Text.FontDescriptorType, text: string) =>
      Ref.update(measureCalls, (count) => count + 1).pipe(
        Effect.as(text.length === 0 ? 0 : text.length * (font.size * 0.58))
      )
  })

  return Layer.mergeAll(
    Text.WordSegmenterLive,
    Text.HyphenationDictionaryLive(),
    Text.EngineProfileLive,
    measurer,
    Text.MeasurementCacheLive.pipe(Layer.provide(measurer))
  )
}

describe("reflow projection contracts", () => {
  it.effect("reflow projection reuses prepared handles across obstacle and width variants", () =>
    Effect.gen(function*() {
      const entry = corpus[0]!
      const measureCalls = yield* Ref.make(0)
      const layer = countingBrowserlessLayer(measureCalls)
      const prepared = yield* Text.prepareWithSegments({
        text: entry.text,
        font: reflowFont,
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))
      const callsAfterPrepare = yield* Ref.get(measureCalls)

      const narrow = projectReflowProjection({
        entry,
        obstaclesEnabled: false,
        prepared,
        requestedWidthPx: 180,
        stageWidthPx: 180
      })
      const obstacleAware = projectReflowProjection({
        entry,
        obstaclesEnabled: true,
        prepared,
        requestedWidthPx: 240,
        stageWidthPx: 240
      })
      const callsAfterProjection = yield* Ref.get(measureCalls)

      expect(callsAfterPrepare).toBeGreaterThan(0)
      expect(callsAfterProjection).toBe(callsAfterPrepare)
      expect(narrow.prepared).toBe(true)
      expect(obstacleAware.prepared).toBe(true)
      expect(obstacleAware.effectiveWidthPx).toBeLessThanOrEqual(obstacleAware.stageWidthPx)
      expect(obstacleAware.summary.lineCount).toBeGreaterThanOrEqual(narrow.summary.lineCount)
    }))

  it.effect("obstacle-aware projection stays on layoutLinesWith without re-entering measurement", () =>
    Effect.gen(function*() {
      const entry = corpus[0]!
      const measureCalls = yield* Ref.make(0)
      const layer = countingBrowserlessLayer(measureCalls)
      const prepared = yield* Text.prepareWithSegments({
        text: entry.text,
        font: reflowFont,
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))
      const request = { maxWidth: 260, lineHeight: 24 }
      const baselineSummary = Text.layout(prepared, request)
      const callsAfterPrepare = yield* Ref.get(measureCalls)
      const projection = projectObstacleTextLayout({
        baselineSummary,
        obstacles: entry.scene.obstacles,
        prepared,
        request
      })
      const callsAfterProjection = yield* Ref.get(measureCalls)

      expect(callsAfterProjection).toBe(callsAfterPrepare)
      expect(projection.summary.lineCount).toBeGreaterThanOrEqual(baselineSummary.lineCount)
      expect(projection.effectiveWidthPx).toBeLessThanOrEqual(request.maxWidth)
      expect(projection.lines.some((line) => line.leftInsetPx > 0 || line.rightInsetPx > 0)).toBe(true)
    }))
})
