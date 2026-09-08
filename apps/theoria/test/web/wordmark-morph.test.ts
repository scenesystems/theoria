import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Arr from "effect/Array"

import { frameAt, frameIntervalMs, segmentProgress, totalFrames } from "../../app/web/view/primitives/wordmarkMorph.js"

const segments = Arr.range(0, 5)

describe("wordmark morph timing", () => {
  it.effect("rests fully Latin at the start of a cycle and fully Greek at its midpoint", () =>
    Effect.sync(() => {
      expect(Arr.map(segments, (index) => segmentProgress(0, index))).toEqual([0, 0, 0, 0, 0, 0])
      expect(Arr.map(segments, (index) => segmentProgress(totalFrames / 2, index))).toEqual([1, 1, 1, 1, 1, 1])
    }))

  it.effect("staggers the sweep from left to right", () =>
    Effect.sync(() => {
      const midSweepFrame = 30 + 12
      const midSweep = Arr.map(segments, (index) => segmentProgress(midSweepFrame, index))

      expect(segmentProgress(midSweepFrame, 0)).toBeGreaterThan(segmentProgress(midSweepFrame, 5))
      expect(Arr.every(Arr.zip(midSweep, Arr.drop(midSweep, 1)), ([left, right]) => left >= right)).toBe(true)
    }))

  it.effect("sweeps back so the cycle ends where it began", () =>
    Effect.sync(() => {
      const beforeEnd = Arr.map(segments, (index) => segmentProgress(totalFrames - 0.001, index))

      expect(Arr.every(beforeEnd, (progress) => progress < 0.05)).toBe(true)
    }))

  it.effect("maps elapsed time onto the cycle in fractional frames", () =>
    Effect.sync(() => {
      expect(frameAt(0)).toBe(0)
      expect(frameAt(frameIntervalMs * 1.5)).toBeCloseTo(1.5)
      expect(frameAt(frameIntervalMs * totalFrames)).toBe(0)
    }))
})
