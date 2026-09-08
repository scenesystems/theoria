import { Registry, Result } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Option } from "effect"

import { DemoRequestError } from "../../app/contracts/demo-error.js"
import {
  placeFailureAtom,
  placeWait,
  placeWaitAtom,
  StageFailure,
  stageFailure
} from "../../app/web/atoms/imagined-place-render.js"
import { placeBuildEnvelopeAtom, placeClientLayerAtom } from "../../app/web/atoms/imagined-place.js"
import { ImaginedPlaceClient } from "../../app/web/services/ImaginedPlaceClient.js"
import { stageFailureActionLabel, stageFailureText } from "../../app/web/view/home/placeViewModel.js"

/**
 * A failure has one home on the stage — the search caption's row, which is
 * there in every state at one height — so nothing around the stage moves for
 * it. What is said there is told from what failed: the build the place is
 * made from, or the drawing of it; and whether the run asked for in its place
 * is under way. Where there is no drawing, the paper is told the same thing,
 * so a paper that is waiting for nothing does not say it is busy.
 */

const failed = Result.fail(new DemoRequestError({ message: "no answer" }))
const failedAndAsked = Result.fail(new DemoRequestError({ message: "no answer" }), { waiting: true })

/** A client whose answer never comes, so a build asked for again stays on its way. */
const holdingClient: Layer.Layer<ImaginedPlaceClient> = Layer.succeed(
  ImaginedPlaceClient,
  ImaginedPlaceClient.make({ build: () => Effect.never })
)

describe("what has failed the stage", () => {
  it.effect("a failed build is the failure, waiting or not; a failed drawing is one only once the build is here", () =>
    Effect.gen(function*() {
      expect(stageFailure(failed, Result.initial())).toEqual(
        Option.some(new StageFailure({ failed: "build", waiting: false }))
      )
      expect(stageFailure(failedAndAsked, Result.initial())).toEqual(
        Option.some(new StageFailure({ failed: "build", waiting: true }))
      )
      expect(stageFailure(Result.success("built"), failed)).toEqual(
        Option.some(new StageFailure({ failed: "draw", waiting: false }))
      )
      expect(stageFailure(Result.success("built"), failedAndAsked)).toEqual(
        Option.some(new StageFailure({ failed: "draw", waiting: true }))
      )
      // The build failing is the reason there is no drawing; the drawing is not a second failure.
      expect(stageFailure(failed, failed)).toEqual(Option.some(new StageFailure({ failed: "build", waiting: false })))
      expect(stageFailure(Result.initial(true), Result.initial())).toEqual(Option.none())
      expect(stageFailure(Result.success("built"), Result.initial(true))).toEqual(Option.none())
    }))

  it.effect("the paper waits while anything is on its way, and is told nothing is coming only once it is so", () =>
    Effect.gen(function*() {
      expect(placeWait(Option.none())).toBe("pending")
      expect(placeWait(Option.some(new StageFailure({ failed: "build", waiting: true })))).toBe("pending")
      expect(placeWait(Option.some(new StageFailure({ failed: "draw", waiting: true })))).toBe("pending")
      expect(placeWait(Option.some(new StageFailure({ failed: "build", waiting: false })))).toBe("failed")
      expect(placeWait(Option.some(new StageFailure({ failed: "draw", waiting: false })))).toBe("failed")
    }))

  it.effect("each failure says what failed and offers the run that answers it; asked for, it says so and offers nothing", () =>
    Effect.gen(function*() {
      const build = new StageFailure({ failed: "build", waiting: false })
      const draw = new StageFailure({ failed: "draw", waiting: false })
      expect(stageFailureText(build)).toBe("The place could not be built.")
      expect(stageFailureActionLabel(build)).toBe("Try again")
      expect(stageFailureText(draw)).toBe("The place could not be drawn.")
      expect(stageFailureActionLabel(draw)).toBe("Draw again")
      expect(stageFailureText(new StageFailure({ ...build, waiting: true }))).toBe("Building the place again.")
      expect(stageFailureText(new StageFailure({ ...draw, waiting: true }))).toBe("Drawing the place again.")
    }))

  it.effect("on the page, a build that failed is the stage's failure until it is asked for again, and the paper is told", () =>
    Effect.gen(function*() {
      const registry = Registry.make({
        initialValues: [
          [placeClientLayerAtom, holdingClient],
          [placeBuildEnvelopeAtom, failed]
        ],
        scheduleTask: (task) => {
          task()
        }
      })
      expect(registry.get(placeFailureAtom)).toEqual(Option.some(new StageFailure({ failed: "build", waiting: false })))
      expect(registry.get(placeWaitAtom)).toBe("failed")
      // Asked to build again: the failure stands, waiting, and the paper waits with it.
      registry.refresh(placeBuildEnvelopeAtom)
      expect(registry.get(placeFailureAtom)).toEqual(Option.some(new StageFailure({ failed: "build", waiting: true })))
      expect(registry.get(placeWaitAtom)).toBe("pending")
    }))
})
