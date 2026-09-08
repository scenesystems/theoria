// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import type { Page } from "@playwright/test"
import { Effect, Layer, Schema } from "effect"
import * as Arr from "effect/Array"

import { stageMaxWidth } from "../../app/contracts/demo/imagined-place-flow.js"
import {
  act,
  animationsSettled,
  BrowserLive,
  goto,
  hover,
  openPage,
  setColorScheme,
  setViewport,
  until,
  visible,
  wheel
} from "./browser.js"
import {
  leaveAndReturn,
  recordedFrameFit,
  recordedPaperFrames,
  recordFrameFit,
  recordPaperFrames,
  stageInItsStep,
  stepWidths
} from "./platform/in-page.js"
import { SiteLive } from "./site.js"

/**
 * The stage follows its column. Below `lg` the column is the page's whole
 * reading width, so the paper takes it up to the widest stage there is and is
 * centred when the column is wider still; the widths offered say so. While
 * the column changes width the drawing already on the stage never stands
 * wider than its frame — the frame is the column's or the drawing's, whichever
 * is narrower, and the drawing is shown fitted to it until the arrangement
 * for the new width lands — and the frame is centred in its viewport at every
 * frame, so a window being resized shows the paper shrinking in place, never
 * a paper cut off at the right.
 */

const rendered = (page: Page) => page.locator("[data-place-render-phase='complete']")

/** One report of the drawing and its paper in their frame; see `recordFrameFit`. */
const FrameFit = Schema.Struct({
  frame: Schema.Number,
  drawing: Schema.Number,
  paper: Schema.Number,
  offCentre: Schema.Number
})
type FrameFit = typeof FrameFit.Type

const frameFit = (reported: string): FrameFit => {
  const [frame = "0", drawing = "0", paper = "0", offCentre = "0"] = reported.split(" ")
  return FrameFit.make({
    frame: Number(frame),
    drawing: Number(drawing),
    paper: Number(paper),
    offCentre: Number(offCentre)
  })
}

const recordedFits = (page: Page) =>
  Effect.map(
    act(() => page.evaluate(recordedFrameFit)),
    (recorded) => Arr.map(Arr.filter(recorded.split("\n"), (line) => line.length > 0), frameFit)
  )

/** The stage drawn for exactly the room the step gives it, up to the widest stage, and centred in any room to spare. */
const stageFillsItsStep = (page: Page, where: string) =>
  Effect.map(
    until(
      act(() => page.evaluate(stageInItsStep)),
      ({ stage, step }) => step > 0 && stage === Math.min(stageMaxWidth, step),
      `the stage is drawn for its step at ${where}`
    ),
    (found) => {
      expect(found.leftOfFrame, `${where}: frame centred`).toBe(found.rightOfFrame)
      expect(found.widestOffered, `${where}: widest width offered`).toBe(`${String(found.stage)} px`)
      return found
    }
  )

layer(Layer.merge(SiteLive, BrowserLive), { excludeTestServices: true, timeout: "3 minutes" })(
  (it) => {
    it.scoped("below lg the stage takes the whole reading column, as wide as the widest stage, and centres beyond it", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 1440, height: 900 } })
        yield* goto(page, "/")
        yield* visible(rendered(page))

        // A window narrower than lg: the column is the page's reading width and the stage takes it whole.
        yield* setViewport(page, { width: 900, height: 900 })
        const narrower = yield* stageFillsItsStep(page, "900px")
        expect(narrower.stage).toBeLessThan(stageMaxWidth)
        expect(narrower.leftOfFrame).toBe(0)
        expect(yield* act(() => page.evaluate(stepWidths))).toEqual({ arrange: narrower.step, compose: narrower.step })

        // A column wider than the widest stage: the paper is the widest stage, centred in the column.
        yield* setViewport(page, { width: 1000, height: 900 })
        const wider = yield* stageFillsItsStep(page, "1000px")
        expect(wider.stage).toBe(stageMaxWidth)
        expect(wider.leftOfFrame).toBeGreaterThan(0)
        expect(yield* failures).toEqual([])
      }))

    it.scoped("while the column is resized neither the drawing nor its paper stands wider than the frame, and the frame stays centred", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 1400, height: 900 } })
        yield* act(() => page.addInitScript(recordFrameFit))
        yield* goto(page, "/")
        yield* visible(rendered(page))
        const settled = yield* stageFillsItsStep(page, "1400px")

        // Narrower, so the drawing already on the stage is wider than the column can hold; then wider again.
        yield* setViewport(page, { width: 1100, height: 900 })
        const narrowed = yield* stageFillsItsStep(page, "1100px")
        expect(narrowed.stage).toBeLessThan(settled.stage)
        yield* setViewport(page, { width: 1400, height: 900 })
        yield* stageFillsItsStep(page, "1400px again")

        const fits = yield* recordedFits(page)
        expect(fits.length).toBeGreaterThan(2)
        Arr.forEach(fits, (fit) => {
          expect(fit.drawing, `drawing ${String(fit.drawing)} in frame ${String(fit.frame)}`).toBeLessThanOrEqual(
            fit.frame + 1
          )
          expect(fit.paper, `paper ${String(fit.paper)} in frame ${String(fit.frame)}`).toBeLessThanOrEqual(
            fit.frame + 1
          )
          expect(Math.abs(fit.offCentre), `frame ${String(fit.frame)} off centre`).toBeLessThanOrEqual(1)
        })
        expect(yield* failures).toEqual([])
      }))

    it.scoped("a landed drawing is redrawn for another width or another build only, never for the reader's presence", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 1280, height: 900 } })
        yield* act(() => page.addInitScript(recordPaperFrames))
        yield* goto(page, "/")
        yield* visible(rendered(page))
        yield* animationsSettled(page)
        const landed = yield* act(() => page.evaluate(recordedPaperFrames))

        // Time passing, the page scrolled down and back, a disc under the pointer, the window left and returned to,
        // the colour scheme changed: none is a change to what is drawn, so none redraws the paper.
        yield* Effect.sleep("3 seconds")
        yield* wheel(page, 0, 900)
        yield* wheel(page, 0, -900)
        yield* hover(page.locator("[data-place-marker]").first())
        yield* act(() => page.evaluate(leaveAndReturn))
        yield* setColorScheme(page, "dark")
        yield* setColorScheme(page, "light")
        yield* Effect.sleep("2 seconds")
        yield* animationsSettled(page)

        expect(yield* act(() => page.evaluate(recordedPaperFrames))).toBe(landed)
        expect(yield* failures).toEqual([])
      }))
  }
)
