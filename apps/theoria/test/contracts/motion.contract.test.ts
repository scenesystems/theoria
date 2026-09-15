import { Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Duration, Effect, Equal, Number as Num, Option, Predicate } from "effect"
import * as Arr from "effect/Array"

import {
  motionArrivalBudget,
  motionDuration,
  MotionEase,
  motionEase,
  motionEaseCss,
  motionEaseCurve,
  motionEaseFor,
  motionPulse,
  MotionRelation,
  motionThemeTokens,
  motionValueWash,
  motionWalkDraw
} from "../../app/contracts/motion.js"
import { placeDiscDrawnAtom, placeDrawnAtom, placeTrialPreviewAtom } from "../../app/web/atoms/imagined-place-render.js"
import { motionConfigReducedMotion } from "../../app/web/atoms/motion.js"
import {
  arrivalFrom,
  exitTransition,
  pulseTransition,
  routeEntranceInitial,
  shiftTransition,
  staggeredArrival,
  themeTransition,
  valueWashTransition,
  walkDrawTransition
} from "../../app/web/view/primitives/motion.js"
import { wordmarkMotion } from "../../app/web/view/primitives/wordmarkMorph.js"

describe("motion contract", () => {
  it.effect("a walk drawing itself and a changed value's wash are slower than any relation, and the wash outlasts the walk", () =>
    Effect.sync(() => {
      expect(Duration.lessThan(motionDuration("shift"), motionWalkDraw)).toBe(true)
      expect(Duration.lessThan(motionWalkDraw, motionValueWash)).toBe(true)
      expect(walkDrawTransition).toEqual({ duration: Duration.toSeconds(motionWalkDraw), ease: motionEase })
      expect(valueWashTransition).toEqual({ duration: Duration.toSeconds(motionValueWash), ease: motionEase })
    }))

  it.effect("a pending placeholder breathes slower than anything arriving, symmetrically, for as long as it is pending", () =>
    Effect.sync(() => {
      expect(Duration.lessThan(motionValueWash, motionPulse)).toBe(true)
      expect(pulseTransition).toEqual({
        duration: Duration.toSeconds(motionPulse),
        ease: "easeInOut",
        repeat: Infinity
      })
    }))

  it.effect("leaves quicker than it arrives, and moves what is already there slowest", () =>
    Effect.sync(() => {
      expect(Duration.lessThan(motionDuration("exit"), motionDuration("enter"))).toBe(true)
      expect(Duration.lessThan(motionDuration("enter"), motionDuration("shift"))).toBe(true)
    }))

  it.effect("a control responds quicker than anything arrives, and what follows a gesture lands before a shift would", () =>
    Effect.sync(() => {
      expect(Duration.lessThan(motionDuration("respond"), motionDuration("enter"))).toBe(true)
      expect(Duration.lessThan(motionDuration("follow"), motionDuration("shift"))).toBe(true)
    }))

  it.effect("only what follows a gesture has its own ease; everything the page moves shares the theme's", () =>
    Effect.sync(() => {
      const [following, own] = Arr.partition(
        MotionRelation.literals,
        (relation) => Equal.equals(motionEaseFor(relation), "theme")
      )
      expect(following).toEqual(["follow"])
      expect(own).toEqual(["enter", "shift", "exit", "respond"])
      expect(motionEaseCurve("theme")).toEqual(motionEase)
      expect(motionEaseCurve("follow")).not.toEqual(motionEase)
    }))

  it.effect("writes one CSS token per relation and one per ease", () =>
    Effect.sync(() => {
      const names = Arr.map(motionThemeTokens, ([name]) => name)
      expect(names).toEqual([
        ...Arr.map(MotionRelation.literals, (relation) => `--th-motion-duration-${relation}`),
        ...Arr.map(MotionEase.literals, (ease) => `--ease-${ease}`)
      ])
      expect(motionThemeTokens).toContainEqual(["--th-motion-duration-exit", "120ms"])
      expect(motionThemeTokens).toContainEqual(["--th-motion-duration-respond", "150ms"])
      expect(motionThemeTokens).toContainEqual(["--ease-theme", motionEaseCss])
      expect(motionThemeTokens).toContainEqual(["--ease-follow", "cubic-bezier(0.32, 0.72, 0, 1)"])
    }))

  it.effect("hands Motion the same durations, in seconds", () =>
    Effect.sync(() => {
      expect(themeTransition).toEqual({ duration: Duration.toSeconds(motionDuration("enter")), ease: motionEase })
      expect(exitTransition.duration).toBe(Duration.toSeconds(motionDuration("exit")))
      expect(shiftTransition).toEqual({ duration: Duration.toSeconds(motionDuration("shift")), ease: motionEase })
    }))

  it.effect("staggers arrivals but lands the last one within the budget however many there are", () =>
    Effect.sync(() => {
      const budget = Duration.toMillis(motionArrivalBudget)
      // Motion takes seconds; compare in whole milliseconds so float sums do not decide the outcome.
      const seconds = (value: unknown): number =>
        Option.getOrElse(Option.liftPredicate(value, Predicate.isNumber), () => 0)
      const lands = (index: number) => {
        const { delay, duration } = staggeredArrival(index)
        return Num.round(Num.multiply(Num.sum(seconds(delay), seconds(duration)), 1000), 0)
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

  it.effect("one source decides what arrives and what rests: a route rises in or is placed, the wordmark crossfades or stands", () =>
    Effect.sync(() => {
      // The preference atom, not Motion's own media-query hook, is the source; these read only the preference.
      expect(routeEntranceInitial("full")).toEqual(arrivalFrom)
      expect(routeEntranceInitial("reduced")).toBe(false)
      expect(wordmarkMotion("full")).toBe("crossfading")
      expect(wordmarkMotion("reduced")).toBe("still")
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
