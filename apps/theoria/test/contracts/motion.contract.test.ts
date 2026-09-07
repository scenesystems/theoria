import { Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Duration, Effect, Option } from "effect"
import * as Arr from "effect/Array"

import {
  motionArrivalBudget,
  motionDuration,
  motionEase,
  motionEaseCss,
  MotionRelation,
  motionThemeTokens
} from "../../app/contracts/motion.js"
import { placeDiscDrawnAtom, placeDrawnAtom, placeTrialPreviewAtom } from "../../app/web/atoms/imagined-place-render.js"
import { motionConfigReducedMotion } from "../../app/web/atoms/motion.js"
import { exitTransition, staggeredArrival, themeTransition } from "../../app/web/view/primitives/motion.js"

describe("motion contract", () => {
  it.effect("leaves quicker than it arrives, and moves what is already there slowest", () =>
    Effect.sync(() => {
      expect(Duration.lessThan(motionDuration("exit"), motionDuration("enter"))).toBe(true)
      expect(Duration.lessThan(motionDuration("enter"), motionDuration("shift"))).toBe(true)
    }))

  it.effect("writes one CSS token per relation and the one easing", () =>
    Effect.sync(() => {
      const names = Arr.map(motionThemeTokens, ([name]) => name)
      expect(names).toEqual([
        ...Arr.map(MotionRelation.literals, (relation) => `--th-motion-duration-${relation}`),
        "--ease-theme"
      ])
      expect(motionThemeTokens).toContainEqual(["--th-motion-duration-exit", "120ms"])
      expect(motionThemeTokens).toContainEqual(["--ease-theme", motionEaseCss])
    }))

  it.effect("hands Motion the same durations, in seconds", () =>
    Effect.sync(() => {
      expect(themeTransition).toEqual({ duration: Duration.toSeconds(motionDuration("enter")), ease: motionEase })
      expect(exitTransition.duration).toBe(Duration.toSeconds(motionDuration("exit")))
    }))

  it.effect("staggers arrivals but lands the last one within the budget however many there are", () =>
    Effect.sync(() => {
      const budget = Duration.toMillis(motionArrivalBudget)
      // Motion takes seconds; compare in whole milliseconds so float sums do not decide the outcome.
      const lands = (index: number) => {
        const { delay, duration } = staggeredArrival(index)
        return Math.round(((delay ?? 0) + (typeof duration === "number" ? duration : 0)) * 1000)
      }
      expect(staggeredArrival(0).delay).toBe(0)
      expect(staggeredArrival(1).delay).toBeGreaterThan(0)
      expect(lands(3)).toBeLessThanOrEqual(budget)
      expect(lands(40)).toBeLessThanOrEqual(budget)
      expect(lands(40)).toBe(lands(400))
    }))

  it.effect("tells Motion to reduce motion exactly when the reader's system asks", () =>
    Effect.sync(() => {
      expect(motionConfigReducedMotion("reduced")).toBe("always")
      expect(motionConfigReducedMotion("full")).toBe("never")
    }))

  it.effect("draws the search's sketch until it settles, and a trial while one is chosen from the trace", () =>
    Effect.sync(() => {
      const registry = Registry.make()
      // Nothing has settled yet: the stage follows the sketch, and every disc on it is Motion's.
      expect(registry.get(placeDrawnAtom)).toBe("sketch")
      expect(registry.get(placeDiscDrawnAtom("Causeway"))).toBe("settled")
      registry.set(placeTrialPreviewAtom, Option.some(2))
      expect(registry.get(placeDrawnAtom)).toBe("trial")
      expect(registry.get(placeDiscDrawnAtom("Causeway"))).toBe("trial")
      registry.set(placeTrialPreviewAtom, Option.none())
      expect(registry.get(placeDrawnAtom)).toBe("sketch")
    }))
})
