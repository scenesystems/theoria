import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"
import * as Arr from "effect/Array"

import { Registry } from "@effect-atom/atom"

import { wordmarkPhaseAtom } from "../../app/web/atoms/wordmark.js"
import {
  frameIntervalMs,
  introDelaySeconds,
  passSeconds,
  segmentPass,
  segmentProgress,
  totalFrames,
  wordmarkPhaseAfter
} from "../../app/web/view/primitives/wordmarkMorph.js"

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
})

describe("wordmark pass keyframes", () => {
  it.effect("one pass is the cycle after its lead hold, and the intro waits out that hold", () =>
    Effect.sync(() => {
      const introFrames = introDelaySeconds * 1_000 / frameIntervalMs
      expect(introFrames + passSeconds * 1_000 / frameIntervalMs).toBeCloseTo(totalFrames)
      expect(introFrames).toBe(30)
    }))

  it.effect("every segment's keyframe times ascend from the start of the pass to its end", () =>
    Effect.sync(() => {
      Arr.forEach(segments, (index) => {
        const { times } = segmentPass(index)
        expect(times[0]).toBe(0)
        expect(times[times.length - 1]).toBe(1)
        expect(Arr.every(Arr.zip(times, Arr.drop(times, 1)), ([earlier, later]) => earlier <= later)).toBe(true)
      })
    }))

  it.effect("the Greek face's keyframes are the cycle's own progress at those moments, and the Latin face is its complement", () =>
    Effect.sync(() => {
      const introFrames = introDelaySeconds * 1_000 / frameIntervalMs
      const passFrames = passSeconds * 1_000 / frameIntervalMs
      Arr.forEach(segments, (index) => {
        const { greek, latin, times } = segmentPass(index)
        Arr.forEach(Arr.zip(times, greek), ([time, opacity]) => {
          expect(segmentProgress(introFrames + time * passFrames, index)).toBeCloseTo(opacity, 6)
        })
        expect(Arr.map(Arr.zip(greek, latin), ([g, l]) => g + l)).toEqual(Arr.map(greek, () => 1))
        expect(greek[0]).toBe(0)
        expect(greek[greek.length - 1]).toBe(0)
      })
    }))

  it.effect("a later segment starts its sweep later and ends its return sooner, so the sweep travels left to right", () =>
    Effect.sync(() => {
      const moment = (segment: number, index: number) => Option.getOrThrow(Arr.get(segmentPass(segment).times, index))
      // The sweep to Greek begins later for the last segment…
      expect(moment(5, 1)).toBeGreaterThan(moment(0, 1))
      // …and the return to Latin, which travels the same direction, completes sooner.
      expect(moment(5, 4)).toBeLessThan(moment(0, 4))
    }))
})

describe("wordmark phase", () => {
  it.effect("a pass that ends comes to rest, whatever pass it was", () =>
    Effect.sync(() => {
      expect(wordmarkPhaseAfter("intro", "passEnded")).toBe("rest")
      expect(wordmarkPhaseAfter("pass", "passEnded")).toBe("rest")
      expect(wordmarkPhaseAfter("rest", "passEnded")).toBe("rest")
    }))

  it.effect("only a resting wordmark plays again when met; a running pass is left to finish", () =>
    Effect.sync(() => {
      expect(wordmarkPhaseAfter("rest", "replayAsked")).toBe("pass")
      expect(wordmarkPhaseAfter("intro", "replayAsked")).toBe("intro")
      expect(wordmarkPhaseAfter("pass", "replayAsked")).toBe("pass")
    }))

  it.effect("the wordmark begins its session in the intro and is told events, not phases", () =>
    Effect.sync(() => {
      const registry = Registry.make()
      expect(registry.get(wordmarkPhaseAtom)).toBe("intro")
      registry.set(wordmarkPhaseAtom, "replayAsked")
      expect(registry.get(wordmarkPhaseAtom)).toBe("intro")
      registry.set(wordmarkPhaseAtom, "passEnded")
      expect(registry.get(wordmarkPhaseAtom)).toBe("rest")
      registry.set(wordmarkPhaseAtom, "replayAsked")
      expect(registry.get(wordmarkPhaseAtom)).toBe("pass")
      // The phase outlives its readers: the intro plays once a session, not once a mount.
      expect(wordmarkPhaseAtom.keepAlive).toBe(true)
    }))
})
