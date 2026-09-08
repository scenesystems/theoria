import { describe, expect, it } from "@effect/vitest"
import { Duration, Effect, Option } from "effect"

import { motionDuration } from "../../app/contracts/motion.js"
import { restBeforeTravel, travelDuration } from "../../app/web/atoms/imagined-place-render.js"

/**
 * When the description changes, the lines set from the old one leave before the
 * discs move on, so lines flowed around where the discs were never stand over
 * discs that have moved: the drawing rests through the lines' exit. Under
 * reduced motion nothing leaves first — the prose is swapped in the same
 * frame the drawing is placed outright — so there is nothing to rest for, and
 * a rest would leave the new lines, flowed around where the discs will be,
 * standing over discs that have not yet moved.
 */

describe("the drawing's rest before it travels", () => {
  it.effect("is the lines' exit while a changed description leaves under full motion", () =>
    Effect.sync(() => {
      expect(restBeforeTravel(Option.some("The rock is bare."), "The rock is bare but for lichen.", "full")).toEqual(
        motionDuration("exit")
      )
    }))

  it.effect("is nothing while the description is the same, or for a first drawing", () =>
    Effect.sync(() => {
      expect(restBeforeTravel(Option.some("The rock is bare."), "The rock is bare.", "full")).toEqual(Duration.zero)
      expect(restBeforeTravel(Option.none(), "The rock is bare.", "full")).toEqual(Duration.zero)
    }))

  it.effect("is nothing under reduced motion, where the prose is swapped as the drawing is placed", () =>
    Effect.sync(() => {
      expect(restBeforeTravel(Option.some("The rock is bare."), "The rock is bare but for lichen.", "reduced")).toEqual(
        Duration.zero
      )
      expect(travelDuration("reduced")).toEqual(Duration.zero)
    }))
})
