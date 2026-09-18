// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import type { Page } from "@playwright/test"
import { Numeric } from "@scenesystems/effect-math"
import { Effect, Layer, Number as Num, Option, Schema } from "effect"
import * as Arr from "effect/Array"
import * as Str from "effect/String"
import { addInitProbe, evaluate, evaluateElement } from "./browser.js"

import { stageMaxWidth } from "../../app/contracts/demo/imagined-place-flow.js"
import {
  animationsSettled,
  BrowserLive,
  click,
  goto,
  hover,
  openPage,
  press,
  setColorScheme,
  setViewport,
  until,
  wheel
} from "./browser.js"
import { drawn, expectClearance, framesUntil, searchSettlesWithin } from "./demo.js"
import {
  boxOf,
  leaveAndReturn,
  recordedFrameFit,
  recordedPaperFrames,
  recordFrameFit,
  recordPaperFrames,
  stageFrame,
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

/** One report of the drawing and its paper in their frame; see `recordFrameFit`. */
const FrameFit = Schema.Struct({
  frame: Schema.NumberFromString,
  drawing: Schema.NumberFromString,
  paper: Schema.NumberFromString,
  offCentre: Schema.NumberFromString
})
type FrameFit = typeof FrameFit.Type

const frameFit = (reported: string): FrameFit => {
  const [frame = "0", drawing = "0", paper = "0", offCentre = "0"] = Str.split(reported, " ")
  return Schema.decodeUnknownSync(FrameFit)({ frame, drawing, paper, offCentre })
}

const recordedFits = (page: Page) =>
  Effect.map(
    evaluate(page, recordedFrameFit),
    (recorded) => Arr.map(Arr.filter(Str.split(recorded, "\n"), Str.isNonEmpty), frameFit)
  )

/** The stage drawn for exactly the room the step gives it, up to the widest stage, and centred in any room to spare. */
const stageFillsItsStep = (page: Page, where: string) =>
  Effect.map(
    until(
      evaluate(page, stageInItsStep),
      ({ stage, step }) => step > 0 && stage === Num.min(stageMaxWidth, step),
      `the stage is drawn for its step at ${where}`,
      searchSettlesWithin
    ),
    (found) => {
      expect(found.leftOfFrame, `${where}: frame centred`).toBe(found.rightOfFrame)
      expect(found.widestOffered, `${where}: widest width offered`).toBe(`${String(found.stage)} px`)
      return found
    }
  )

layer(Layer.merge(SiteLive, BrowserLive), { excludeTestServices: true, timeout: "3 minutes" })(
  (it) => {
    it.scoped("wide screens leave reading margins while Arrange reaches 720px, with chrome on the same edges", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 1920, height: 1080 } })
        yield* goto(page, "/")
        yield* drawn(page)
        yield* Effect.forEach([1920, 2560], (width) =>
          Effect.gen(function*() {
            yield* setViewport(page, { width, height: 1080 })
            const stage = yield* stageFillsItsStep(page, `${String(width)}px`)
            expect(stage.stage).toBe(720)
            const columns = yield* evaluateElement(page.locator("[data-place-columns]"), boxOf)
            expect(columns.width).toBe(1504)
            expect(columns.left).toBeGreaterThan(190)
            const header = yield* evaluateElement(
              page.locator("header").filter({ has: page.getByRole("navigation", { name: "Site" }) }),
              boxOf
            )
            const footer = yield* evaluateElement(page.locator("[data-site-footer]"), boxOf)
            expect(header.left).toBe(columns.left)
            expect(footer.right).toBe(columns.right)
            const canvas = yield* evaluateElement(page.locator("main"), boxOf)
            expect(columns.centreX).toBe(canvas.centreX)
          }))
        expect(yield* failures).toEqual([])
      }))

    it.scoped("below lg the stage takes the whole reading column, as wide as the widest stage, and centres beyond it", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 1440, height: 900 } })
        yield* goto(page, "/")
        yield* drawn(page)

        // A window narrower than lg: the column is the page's reading width and the stage takes it whole.
        yield* setViewport(page, { width: 900, height: 900 })
        const narrower = yield* stageFillsItsStep(page, "900px")
        expect(narrower.stage).toBeLessThan(stageMaxWidth)
        expect(narrower.leftOfFrame).toBe(0)
        expect(yield* evaluate(page, stepWidths)).toEqual({ arrange: narrower.step, compose: narrower.step })

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
        yield* addInitProbe(page, recordFrameFit)
        yield* goto(page, "/")
        yield* drawn(page)
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
            Num.increment(fit.frame)
          )
          expect(fit.paper, `paper ${String(fit.paper)} in frame ${String(fit.frame)}`).toBeLessThanOrEqual(
            Num.increment(fit.frame)
          )
          expect(Numeric.abs(fit.offCentre), `frame ${String(fit.frame)} off centre`).toBeLessThanOrEqual(1)
        })
        expect(yield* failures).toEqual([])
      }))

    /**
     * The drawing left on the wide stage is drawn first on the narrow one,
     * fitted to it; the least line beside a disc does not scale with the
     * discs, so a disc that stood at the wide stage's left would stand over
     * the narrow stage's first lines unless it is set on the narrow stage's
     * rules before the prose is flowed around it. Every frame from the
     * narrowing until the new arrangement lands keeps the gap.
     */
    it.scoped("from the widest column to the narrowest, every frame keeps the gap between prose and discs", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 1400, height: 900 } })
        yield* goto(page, "/")
        yield* drawn(page)
        yield* stageFillsItsStep(page, "1400px")
        const demo = page.getByRole("region", { name: "Imagined place demo" })

        // The landed drawing stays complete until the narrow stage's search begins; the frames that matter run
        // from its first trial to its landing.
        yield* setViewport(page, { width: 320, height: 700 })
        const first = yield* until(
          evaluateElement(demo, stageFrame),
          (frame) => frame.phase !== "complete",
          "the narrow stage's search is drawing"
        )
        const frames = Arr.prepend(
          yield* framesUntil(demo, (frame) => frame.phase === "complete", searchSettlesWithin),
          first
        )
        // The landing is the narrow stage's: drawn for the step's whole width (no widths are offered this narrow).
        const landed = yield* evaluate(page, stageInItsStep)
        expect(landed.stage).toBe(landed.step)

        expect(Arr.last(frames).pipe(Option.map((frame) => frame.phase))).toEqual(Option.some("complete"))
        expect(Arr.flatMap(frames, (frame) => frame.overlaps)).toEqual([])
        expectClearance(frames)
        expect(yield* failures).toEqual([])
      }))

    it.scoped("a landed drawing is redrawn for another width or another build only, never for the reader's presence", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 1280, height: 900 } })
        yield* addInitProbe(page, recordPaperFrames)
        yield* goto(page, "/")
        yield* drawn(page)
        yield* animationsSettled(page)
        const landed = yield* evaluate(page, recordedPaperFrames)

        // Time passing, the page scrolled down and back, a disc under the pointer and then pressed for its answer,
        // the window left and returned to, the colour scheme changed: none is a change to what is drawn, so none
        // redraws the paper.
        yield* Effect.sleep("3 seconds")
        yield* wheel(page, 0, 900)
        yield* wheel(page, 0, -900)
        const disc = page.locator("[data-place-marker]").first()
        yield* hover(disc)
        yield* click(disc)
        yield* press(page, "Escape")
        yield* evaluate(page, leaveAndReturn)
        yield* setColorScheme(page, "dark")
        yield* setColorScheme(page, "light")
        yield* Effect.sleep("2 seconds")
        yield* animationsSettled(page)

        expect(yield* evaluate(page, recordedPaperFrames)).toBe(landed)
        expect(yield* failures).toEqual([])
      }))
  }
)
