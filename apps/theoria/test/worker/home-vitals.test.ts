// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import type { Page } from "@playwright/test"
import { Effect, Fiber, Layer, Option, Schema } from "effect"
import * as Arr from "effect/Array"
import * as Rec from "effect/Record"

import { webVitalBudgets } from "../../app/contracts/performance.js"
import { act, animationsSettled, BrowserLive, click, goto, nextResponse, openPage, visible } from "./browser.js"
import { drawn } from "./demo.js"
import { footprintsUntilLanding, heightsByRegion } from "./footprints.js"
import {
  canvasLight,
  recordedDemonstrationShifts,
  recordedWebVitals,
  recordFootprints,
  recordWebVitals
} from "./platform/in-page.js"
import { SiteLive } from "./site.js"

/** A measurement in milliseconds that may not have been made: empty where nothing was observed. */
const ObservedMs = Schema.OptionFromNonEmptyTrimmedString.pipe(
  Schema.compose(Schema.OptionFromSelf(Schema.NumberFromString))
)

/**
 * What `recordWebVitals` observed, as `recordedWebVitals` reports it. Every
 * field is required, so a page the recorder never ran in decodes to nothing
 * rather than to a measurement of zero.
 */
const WebVitals = Schema.Struct({
  lcp: ObservedMs,
  layoutShiftTotal: Schema.NumberFromString,
  inp: ObservedMs,
  eventThresholdMs: Schema.NumberFromString,
  interactions: Schema.NumberFromString,
  /** Each reported interaction's duration, in the order first observed, so a failure names the slow one. */
  interactionDurations: Schema.String
})

const viewports = [{ width: 1440, height: 900 }, { width: 390, height: 844 }]
const searching = (page: Page) => page.locator("[data-place-render-phase='running']")

const readVitals = (page: Page) =>
  Effect.flatMap(act(() => page.evaluate(recordedWebVitals)), Schema.decodeUnknown(WebVitals))

/**
 * INP as the budget sees it. An interaction the observer did not report was
 * quicker than its least duration, so with interactions and no INP the page's
 * INP is at most that threshold; with no interactions there is no INP to
 * judge, and the test that expected one fails on the count.
 */
const interactionToNextPaint = (vitals: typeof WebVitals.Type): number =>
  Option.getOrElse(vitals.inp, () => vitals.eventThresholdMs)

layer(Layer.merge(SiteLive, BrowserLive), { excludeTestServices: true, timeout: "2 minutes" })(
  "Theoria homepage web vitals in Chromium",
  (it) => {
    it.scoped("the homepage's first paint stays within its vitals budgets", () =>
      Effect.forEach(viewports, (viewport) =>
        Effect.gen(function*() {
          const { failures, page } = yield* openPage({ viewport })
          yield* act(() => page.addInitScript(recordWebVitals))
          yield* goto(page, "/")
          yield* drawn(page)
          yield* animationsSettled(page)
          const vitals = yield* readVitals(page)
          // A first paint was observed, and it was within budget; a paint never observed is not one within budget.
          expect(Option.isSome(vitals.lcp)).toBe(true)
          expect(Option.getOrElse(vitals.lcp, () => Number.POSITIVE_INFINITY)).toBeLessThanOrEqual(
            webVitalBudgets.lcpMs
          )
          // The lifetime total of shifts is never less than CLS, so a total within the budget is a CLS within it.
          expect(vitals.layoutShiftTotal).toBeLessThanOrEqual(webVitalBudgets.cls)
          // The demonstration's placeholders stand at the height of what they stand in for: its own loading shifts nothing.
          expect(yield* act(() => page.evaluate(recordedDemonstrationShifts))).toBe("")
          expect(yield* failures).toEqual([])
        })))

    /**
     * What stands in for the demonstration while it loads stands at the height
     * of what it stands in for: from the frame a step card or the stage's
     * column is first painted until the drawing lands, each keeps one height.
     * A shift the layout-shift observer would forgive — too small, or before
     * it counts — is still a change of shape, so the footprint is what is
     * asserted, not the score.
     */
    it.scoped("each region of the demonstration is painted at one height from its first frame until the drawing lands", () =>
      Effect.forEach(viewports, (viewport) =>
        Effect.gen(function*() {
          const { failures, page } = yield* openPage({ viewport })
          yield* act(() => page.addInitScript(recordFootprints))
          yield* goto(page, "/")
          yield* drawn(page)
          const heights = heightsByRegion(yield* footprintsUntilLanding(page))
          expect(Rec.keys(heights)).toEqual(
            expect.arrayContaining(["step:compose", "step:propose", "step:record", "stage:column"])
          )
          Arr.forEach(Rec.toEntries(heights), ([region, painted]) => {
            expect(painted, `${region} at ${String(viewport.width)}px`).toHaveLength(1)
          })
          expect(yield* failures).toEqual([])
        })))

    /**
     * The light on the canvas — the washes at the page's top corners — is
     * shaded once, on a fixed layer of its own beneath the page, not on the
     * body's box. On the body it is on the document's root layer, where any
     * repaint — a ring around a pressed trigger, a frame of the search —
     * re-shades the gradient tile by tile, and a press on a phone waits
     * behind it. The light is also no part of the page: nothing can point at it.
     */
    it.scoped("the canvas light is its own fixed layer, not the body's paint", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 390, height: 844 } })
        yield* goto(page, "/")
        yield* drawn(page)
        const lit = yield* act(() => page.evaluate(canvasLight))
        expect(lit.bodyImage).toBe("none")
        expect(lit.light.image).toContain("radial-gradient")
        expect(lit.light.position).toBe("fixed")
        expect(lit.light.inset).toBe("0px 0px 0px 0px")
        expect(lit.light.pointerEvents).toBe("none")
        expect(lit.light.zIndex).toBe("-1")
        expect(yield* failures).toEqual([])
      }))

    /**
     * The search is the work the page must stay responsive through: the
     * worker's trials come in and the drawing travels between them. A story
     * change starts one; once its search is running, a mark is asked how it
     * knows — an interaction on the main thread while the trials are coming
     * in — and both interactions are held to the budget. The interactions are
     * counted from the events themselves, so a page that was never touched, or
     * a recorder that never ran, cannot pass as a responsive one.
     */
    it.scoped("an interaction while the search runs stays within the INP budget", () =>
      Effect.forEach(viewports, (viewport) =>
        Effect.gen(function*() {
          const { failures, page } = yield* openPage({ viewport })
          yield* act(() => page.addInitScript(recordWebVitals))
          yield* goto(page, "/")
          yield* drawn(page)
          yield* animationsSettled(page)
          const scenarios = page.getByRole("radiogroup", { name: "Scenario" })
          const rebuild = yield* Effect.fork(nextResponse(page, "POST", "/api/imagined-place/build"))
          yield* click(scenarios.getByRole("radio", { checked: false }).first())
          expect((yield* Fiber.join(rebuild)).status()).toBe(200)
          // The new build's search is running: the trials are coming in and the drawing is travelling.
          yield* visible(searching(page))
          yield* click(page.getByRole("button", { name: "effect-dsp", exact: true }))
          const phaseAfterClick = yield* act(() =>
            page.locator("[data-place-trace]").getAttribute("data-place-render-phase")
          )
          expect(phaseAfterClick).not.toBe("complete")
          yield* drawn(page)
          yield* animationsSettled(page)
          const vitals = yield* readVitals(page)
          expect(vitals.interactions).toBeGreaterThanOrEqual(2)
          expect(
            interactionToNextPaint(vitals),
            `${String(viewport.width)}px: interactions took ${vitals.interactionDurations} ms`
          ).toBeLessThanOrEqual(webVitalBudgets.inpMs)
          expect(yield* failures).toEqual([])
        })))
  }
)
