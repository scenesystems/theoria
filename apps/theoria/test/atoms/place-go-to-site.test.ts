import { Registry, Result } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, MutableRef, Option } from "effect"
import * as Arr from "effect/Array"

import { codeSite, PlaceAnswer, placeSourceId } from "../../app/contracts/demo/imagined-place-provenance.js"
import {
  placeAnswerAtom,
  placeAnswerFocusReturnAtom,
  placeCodeSiteAttribute,
  placeGoToSiteAtom
} from "../../app/web/atoms/imagined-place-experience.js"
import { placeShownFrameAtom } from "../../app/web/atoms/imagined-place-render.js"
import { placeBuildAtom, placeStepAtom } from "../../app/web/atoms/imagined-place.js"
import { motionPreferenceAtom, scrollBehaviorFor } from "../../app/web/atoms/motion.js"
import * as BrowserDocument from "../../app/web/platform/BrowserDocument.js"
import * as BrowserWindow from "../../app/web/platform/BrowserWindow.js"
import { onStage } from "../helpers/place-on-stage.js"
import { waitFor } from "../helpers/react-mount.js"

/**
 * From an answer's credited line to the code that is it: one route, owned by
 * the page. The step whose code holds the line is selected, the answer is let
 * go without sending focus back to its mark, the section becomes the history
 * entry, and — once the step has rendered — the line's gutter mark is brought
 * to the middle of the viewport and given focus. The scroll glides or lands
 * at once as the reader's motion preference says.
 */

const pageLayer = Layer.mergeAll(BrowserDocument.layer, BrowserWindow.layer)

/** A gutter mark for `siteId` on the page for the scope, recording how it was scrolled to. */
const gutterMarkOnPage = (siteId: string) =>
  Effect.gen(function*() {
    const browserDocument = yield* BrowserDocument.BrowserDocument
    const scrolledWith = MutableRef.make(Option.none<ScrollIntoViewOptions>())
    const mark = browserDocument.createElement("button")
    mark.setAttribute(placeCodeSiteAttribute, siteId)
    Reflect.defineProperty(mark, "scrollIntoView", {
      configurable: true,
      value: (options: ScrollIntoViewOptions) => MutableRef.set(scrolledWith, Option.some(options))
    })
    yield* Effect.acquireRelease(
      Effect.sync(() => {
        browserDocument.body.append(mark)
      }),
      () =>
        Effect.sync(() => {
          mark.remove()
        })
    )
    return { mark, scrolledWith }
  })

/** The window at the root with no fragment for the scope, so a route's entry is seen from nothing. */
const atRoot = Effect.flatMap(BrowserWindow.BrowserWindow, (browserWindow) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      browserWindow.history.replaceState(null, "", "/")
    }),
    () =>
      Effect.sync(() => {
        browserWindow.history.replaceState(null, "", "/")
      })
  ))

const arrivedWith = (preference: "full" | "reduced") =>
  Effect.gen(function*() {
    const browserDocument = yield* BrowserDocument.BrowserDocument
    const browserWindow = yield* BrowserWindow.BrowserWindow
    yield* atRoot
    const { build, showingTrial, trial } = yield* onStage
    const site = codeSite("layout")
    const { mark, scrolledWith } = yield* gutterMarkOnPage(site.id)
    const registry = Registry.make({
      initialValues: [
        [placeBuildAtom, Result.success(build)],
        [placeShownFrameAtom, Result.success(showingTrial)],
        [motionPreferenceAtom, preference]
      ],
      scheduleTask: (task) => {
        task()
      }
    })
    const name = (yield* Arr.head(trial.projection.markers)).name
    registry.set(placeStepAtom, "compose")
    registry.set(
      placeAnswerAtom,
      Option.some(
        new PlaceAnswer({
          triggerId: "d",
          mark: { _tag: "Disc", name, source: placeSourceId(build) },
          opening: "press"
        })
      )
    )
    expect(registry.get(placeAnswerFocusReturnAtom)).toBe("mark")

    registry.set(placeGoToSiteAtom, site.id)

    return { browserDocument, browserWindow, mark, registry, scrolledWith, site }
  })

describe("the route from a credited line to its code", () => {
  it.effect("selects the step, lets the answer go where it is, enters the section and lands on the line", () =>
    Effect.gen(function*() {
      const { browserDocument, browserWindow, mark, registry, scrolledWith, site } = yield* arrivedWith("full")

      // Before a frame has passed: the page already reads as the destination.
      expect(registry.get(placeStepAtom)).toBe(site.step)
      expect(registry.get(placeAnswerAtom)).toEqual(Option.none())
      expect(registry.get(placeAnswerFocusReturnAtom)).toBe("stays")

      // After the step has rendered: the line has focus, mid-viewport, and the section is the entry.
      yield* waitFor(() => browserDocument.activeElement === mark)
      expect(browserWindow.location.hash).toBe("#how-its-built")
      expect(MutableRef.get(scrolledWith)).toEqual(Option.some({ behavior: "smooth", block: "center" }))
    }).pipe(Effect.scoped, Effect.provide(pageLayer)))

  it.effect("lands at once when the reader asks for reduced motion", () =>
    Effect.gen(function*() {
      const { browserDocument, mark, scrolledWith } = yield* arrivedWith("reduced")
      yield* waitFor(() => browserDocument.activeElement === mark)
      expect(MutableRef.get(scrolledWith)).toEqual(Option.some({ behavior: "instant", block: "center" }))
    }).pipe(Effect.scoped, Effect.provide(pageLayer)))

  it.effect("the scroll's manner is the motion preference's", () =>
    Effect.sync(() => {
      expect(scrollBehaviorFor("full")).toBe("smooth")
      expect(scrollBehaviorFor("reduced")).toBe("instant")
    }))
})
