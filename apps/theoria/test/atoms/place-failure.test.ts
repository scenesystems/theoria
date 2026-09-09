import { Registry, Result } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Errors, Text } from "@scenesystems/effect-text"
import * as Contracts from "@scenesystems/effect-text/contracts"
import { Effect, Layer, Option, Ref } from "effect"

import { DemoRequestError } from "../../app/contracts/demo-error.js"
import {
  placeAgainAtom,
  placeFailureAtom,
  placeSheetAtom,
  placeWait,
  placeWaitAtom,
  StageFailure,
  stageFailure
} from "../../app/web/atoms/imagined-place-render.js"
import {
  placeBuildEnvelopeAtom,
  placeClientLayerAtom,
  placeStageContainerWidthAtom
} from "../../app/web/atoms/imagined-place.js"
import { textLayoutLayerAtom } from "../../app/web/atoms/text-layout.js"
import { ImaginedPlaceClient } from "../../app/web/services/ImaginedPlaceClient.js"
import { browserEngineProfile, type BrowserTextLayout } from "../../app/web/text/browserTextLayout.js"
import { stageFailureActionLabel, stageFailureText } from "../../app/web/view/home/placeViewModel.js"

/**
 * A failure has one home on the stage — the search caption's row, which is
 * there in every state at one height — so nothing around the stage moves for
 * it. What is said there is told from what failed: the build the place is
 * made from, or the drawing of it — the frame, or before the first frame the
 * cut of the paper the frame is expected to want; and whether the run asked
 * for in its place is under way. Where there is no drawing, the paper is told
 * the same thing, so a paper that is waiting for nothing does not say it is
 * busy — and a paper that cannot be cut is never left uncut in silence.
 */

const failed = Result.fail(new DemoRequestError({ message: "no answer" }))
const failedAndAsked = Result.fail(new DemoRequestError({ message: "no answer" }), { waiting: true })
const drawn = Result.success("a frame")
const cut = Result.success(480)

/** A client whose answer never comes, so a build asked for again stays on its way. */
const holdingClient: Layer.Layer<ImaginedPlaceClient> = Layer.succeed(
  ImaginedPlaceClient,
  ImaginedPlaceClient.make({ build: () => Effect.never })
)

/**
 * Text layout whose first measurement fails and every later one is estimated:
 * a canvas that threw once. What the page does with the failure, and with the
 * paper asked for again, is what is under test.
 */
const failingOnceTextLayout: Layer.Layer<BrowserTextLayout> = Layer.unwrapEffect(
  Effect.map(Ref.make(false), (askedBefore) => {
    const estimate = Layer.succeed(Contracts.TextMeasurer, {
      measure: (font, text) =>
        Effect.flatMap(
          Ref.getAndSet(askedBefore, true),
          (asked) =>
            asked
              ? Effect.provide(
                Effect.flatMap(Contracts.TextMeasurer, (measurer) => measurer.measure(font, text)),
                Text.TextMeasurerLive
              )
              : Effect.fail(
                new Errors.MeasurementFailed({
                  fontFamily: font.family,
                  fontSize: font.size,
                  text,
                  reason: "measureText threw"
                })
              )
        )
    })
    return Layer.mergeAll(
      Text.WordSegmenterLive,
      Text.HyphenationDictionaryLive(),
      Layer.succeed(Contracts.EngineProfile, browserEngineProfile),
      estimate,
      Text.MeasurementCacheLive.pipe(Layer.provide(estimate))
    )
  })
)

describe("what has failed the stage", () => {
  it.effect("a failed build is the failure, waiting or not; a failed drawing is one only once the build is here", () =>
    Effect.gen(function*() {
      expect(stageFailure(failed, Result.initial(), cut)).toEqual(
        Option.some(new StageFailure({ failed: "build", waiting: false }))
      )
      expect(stageFailure(failedAndAsked, Result.initial(), cut)).toEqual(
        Option.some(new StageFailure({ failed: "build", waiting: true }))
      )
      expect(stageFailure(Result.success("built"), failed, cut)).toEqual(
        Option.some(new StageFailure({ failed: "draw", waiting: false }))
      )
      expect(stageFailure(Result.success("built"), failedAndAsked, cut)).toEqual(
        Option.some(new StageFailure({ failed: "draw", waiting: true }))
      )
      // The build failing is the reason there is no drawing; the drawing is not a second failure.
      expect(stageFailure(failed, failed, cut)).toEqual(
        Option.some(new StageFailure({ failed: "build", waiting: false }))
      )
      expect(stageFailure(Result.initial(true), Result.initial(), cut)).toEqual(Option.none())
      expect(stageFailure(Result.success("built"), Result.initial(true), cut)).toEqual(Option.none())
    }))

  it.effect("a paper that cannot be cut is the drawing's failure until a frame is here to cut it from", () =>
    Effect.gen(function*() {
      // Before the build: the paper is cut from the outline; a cut that failed is told, not left uncut.
      expect(stageFailure(Result.initial(true), Result.initial(), failed)).toEqual(
        Option.some(new StageFailure({ failed: "draw", waiting: false }))
      )
      expect(stageFailure(Result.initial(true), Result.initial(), failedAndAsked)).toEqual(
        Option.some(new StageFailure({ failed: "draw", waiting: true }))
      )
      // With the build here and the search under way, the same.
      expect(stageFailure(Result.success("built"), Result.initial(true), failed)).toEqual(
        Option.some(new StageFailure({ failed: "draw", waiting: false }))
      )
      // A frame cuts its own paper: what the outline's cut came to no longer matters.
      expect(stageFailure(Result.success("built"), drawn, failed)).toEqual(Option.none())
      expect(stageFailure(Result.success("built"), Result.success("a frame", { waiting: true }), failed)).toEqual(
        Option.none()
      )
      // The build failing is still the reason there is nothing to draw.
      expect(stageFailure(failed, Result.initial(), failed)).toEqual(
        Option.some(new StageFailure({ failed: "build", waiting: false }))
      )
    }))

  it.effect("on the page, a paper that could not be cut is told, and cut when the drawing is asked for again", () =>
    Effect.gen(function*() {
      const registry = Registry.make({
        initialValues: [
          [placeClientLayerAtom, holdingClient],
          [textLayoutLayerAtom, failingOnceTextLayout],
          [placeStageContainerWidthAtom, Option.some(704)]
        ],
        scheduleTask: (task) => {
          task()
        }
      })
      // The build is on its way; the paper should be cut from the outline meanwhile, and could not be.
      expect(registry.get(placeSheetAtom)).toEqual(Option.none())
      expect(registry.get(placeFailureAtom)).toEqual(Option.some(new StageFailure({ failed: "draw", waiting: false })))
      expect(registry.get(placeWaitAtom)).toBe("failed")
      // Asked to draw again: the paper is cut, and nothing is failed.
      registry.set(placeAgainAtom, "draw")
      expect(registry.get(placeFailureAtom)).toEqual(Option.none())
      expect(registry.get(placeWaitAtom)).toBe("pending")
      expect(Option.map(registry.get(placeSheetAtom), (sheet) => sheet.width)).toEqual(Option.some(704))
    }))

  it.effect("asked to build again, the build is what is asked for", () =>
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
      registry.set(placeAgainAtom, "build")
      expect(registry.get(placeFailureAtom)).toEqual(Option.some(new StageFailure({ failed: "build", waiting: true })))
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
