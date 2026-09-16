import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Match, Number, Ref, String } from "effect"
import * as Arr from "effect/Array"
import * as MutableRef from "effect/MutableRef"

import { Contracts, Text } from "../../src/index.js"

const maxWidthAtLine = (request: Text.LayoutRequestType, lineIndex: number): number =>
  Match.value(lineIndex).pipe(
    Match.when(0, () => request.maxWidth),
    Match.orElse(() => 40)
  )

const makeTestContext = Effect.gen(function*() {
  const measurements = yield* Ref.make(0)
  const measurerLayer = Layer.succeed(Contracts.TextMeasurer, {
    measure: (_font, text: string) =>
      Ref.update(measurements, Number.increment).pipe(Effect.as(Number.multiply(String.length(text), 5)))
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
      expect(MutableRef.get(widthResolutionCount)).toBe(Arr.length(projected))
      expect(Arr.length(projected)).toBeGreaterThan(Arr.length(uniform))
      expect(
        Arr.every(
          projected,
          (line) => Number.lessThanOrEqualTo(line.width, Number.sum(maxWidthAtLine(request, line.index), 0.01))
        )
      ).toBe(true)
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

  it.effect("does not resolve a width when prepared text emits no lines", () =>
    Effect.gen(function*() {
      const { layer } = yield* makeTestContext
      const widthResolutionCount = MutableRef.make(0)
      const prepared = yield* Text.prepareWithSegments({
        text: "",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))
      const lines = Text.layoutLinesWith(prepared, { maxWidth: 80, lineHeight: 14 }, () => {
        MutableRef.increment(widthResolutionCount)
        return 80
      })

      expect(lines).toEqual(Arr.empty())
      expect(MutableRef.get(widthResolutionCount)).toBe(0)
    }))
})
