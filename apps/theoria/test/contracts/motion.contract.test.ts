import { Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Duration, Option } from "effect"
import * as Arr from "effect/Array"

import {
  motionArrivalBudget,
  motionDuration,
  motionEaseCss,
  MotionRelation,
  motionThemeTokens
} from "../../app/contracts/motion.js"
import { placeDrawnAtom, placeTrialPreviewAtom } from "../../app/web/atoms/imagined-place-render.js"
import { motionConfigReducedMotion } from "../../app/web/atoms/motion.js"
import { exitTransition, staggeredArrival, themeTransition } from "../../app/web/view/primitives/motion.js"

describe("motion contract", () => {
  it("leaves quicker than it arrives, and moves what is already there slowest", () => {
    expect(Duration.lessThan(motionDuration("exit"), motionDuration("enter"))).toBe(true)
    expect(Duration.lessThan(motionDuration("enter"), motionDuration("shift"))).toBe(true)
  })

  it("writes one CSS token per relation and the one easing", () => {
    const names = Arr.map(motionThemeTokens, ([name]) => name)
    expect(names).toEqual([
      ...Arr.map(MotionRelation.literals, (relation) => `--th-motion-duration-${relation}`),
      "--ease-theme"
    ])
    expect(motionThemeTokens).toContainEqual(["--th-motion-duration-exit", "120ms"])
    expect(motionThemeTokens).toContainEqual(["--ease-theme", motionEaseCss])
  })

  it("hands Motion the same durations, in seconds", () => {
    expect(themeTransition.duration).toBe(Duration.toSeconds(motionDuration("enter")))
    expect(themeTransition).toMatchObject({ layout: { duration: Duration.toSeconds(motionDuration("shift")) } })
    expect(exitTransition.duration).toBe(Duration.toSeconds(motionDuration("exit")))
  })

  it("staggers arrivals but lands the last one within the budget however many there are", () => {
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
  })

  it("tells Motion to reduce motion exactly when the reader's system asks", () => {
    expect(motionConfigReducedMotion("reduced")).toBe("always")
    expect(motionConfigReducedMotion("full")).toBe("never")
  })

  it("draws the kept arrangement unless a trial is chosen from the trace", () => {
    const registry = Registry.make()
    expect(registry.get(placeDrawnAtom)).toBe("kept")
    registry.set(placeTrialPreviewAtom, Option.some(2))
    expect(registry.get(placeDrawnAtom)).toBe("trial")
    registry.set(placeTrialPreviewAtom, Option.none())
    expect(registry.get(placeDrawnAtom)).toBe("kept")
  })
})
