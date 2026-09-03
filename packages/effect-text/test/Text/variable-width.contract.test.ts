import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Match, Ref } from "effect"
import * as Arr from "effect/Array"
import * as MutableRef from "effect/MutableRef"

import { Contracts, Text } from "../../src/index.js"

const maxWidthAtLine = (request: { readonly maxWidth: number }, lineIndex: number): number =>
  Match.value(lineIndex).pipe(
    Match.when(0, () => request.maxWidth),
    Match.orElse(() => 40)
  )

const makeTestContext = Effect.gen(function*() {
  const measurements = yield* Ref.make(0)
  const measurerLayer = Layer.succeed(Contracts.TextMeasurer, {
    measure: (_font, text: string) => Ref.update(measurements, (count) => count + 1).pipe(Effect.as(text.length * 5))
  })

  return {
    measurements,
    layer: Layer.mergeAll(
      Text.WordSegmenterLive,
      Text.EngineProfileLive,
      Text.MeasurementCacheLive.pipe(Layer.provide(measurerLayer))
    )
  }
})

describe("Text variable-width contracts", () => {
  it.effect("layoutLinesWith resolves per-line widths without re-preparing text", () =>
    Effect.gen(function*() {
      const { measurements, layer } = yield* makeTestContext
      const request = { maxWidth: 80, lineHeight: 14 }
      const widthResolutionCount = MutableRef.make(0)
      const prepared = yield* Text.prepareWithSegments({
        text: "The quick brown fox jumps over the lazy dog near a stream of flowing water",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))
      const afterPrepare = yield* Ref.get(measurements)
      const projected = Text.layoutLinesWith(prepared, request, (lineIndex) => {
        MutableRef.increment(widthResolutionCount)
        return maxWidthAtLine(request, lineIndex)
      })
      const uniform = Text.layoutLinesWith(prepared, request, () => request.maxWidth)
      const afterProjection = yield* Ref.get(measurements)

      expect(afterProjection).toBe(afterPrepare)
      expect(MutableRef.get(widthResolutionCount)).toBe(projected.length)
      expect(projected.length).toBeGreaterThan(uniform.length)
      expect(Arr.every(projected, (line) => line.width <= maxWidthAtLine(request, line.index) + 0.01)).toBe(true)
    }))

  it.effect("variable-width projection does not re-enter measurement or service lookup after preparation", () =>
    Effect.gen(function*() {
      const { measurements, layer } = yield* makeTestContext
      const request = { maxWidth: 90, lineHeight: 14 }
      const prepared = yield* Text.prepareWithSegments({
        text: "Layout projections should stay pure after preparation finishes.",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))
      const afterPrepare = yield* Ref.get(measurements)

      const narrow = Text.layoutLinesWith(prepared, request, () => 35)
      const wide = Text.layoutLinesWith(prepared, request, () => request.maxWidth)
      const afterProjection = yield* Ref.get(measurements)

      expect(afterProjection).toBe(afterPrepare)
      expect(Arr.map(narrow, (line) => line.text)).not.toEqual(Arr.map(wide, (line) => line.text))
    }))
})
