// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import type { Page } from "@playwright/test"
import { Effect, Fiber, Layer } from "effect"
import * as Arr from "effect/Array"
import * as Rec from "effect/Record"
import * as Str from "effect/String"

import { measuredFont } from "../../app/contracts/text.js"
import {
  act,
  BrowserLive,
  count,
  desktop,
  eventually,
  gotoParsed,
  holdResponses,
  nextResponse,
  openPage,
  phone,
  until,
  type Viewport,
  visible
} from "./browser.js"
import { aroundSecondSearch, footprintsSoFar, heightsByRegion, restingHeights, untilLanding } from "./footprints.js"
import {
  recordedDemonstrationShifts,
  recordedPaperFrames,
  recordFootprints,
  recordPaperFrames,
  recordWebVitals,
  storyDrawn,
  textBlockMetrics,
  typefaces
} from "./platform/in-page.js"
import { SiteLive } from "./site.js"

/**
 * The page's type, from the first paint to the served faces' arrival. Until
 * they arrive the text is set in a stand-in declared at the served face's
 * metrics, so the swap moves nothing. The stage is not held for them: the
 * story is measured in the face the page shows, the paper cut and the drawing
 * landed in the stand-in; and when the faces land the layout is built again
 * in them, the story measured again, and the drawing searched again on the
 * paper it holds — so no width the stand-in gave outlives the face that gave
 * it, and nothing around the stage moves for the swap. The faces are held at
 * the browser's edge to keep the stand-in state for as long as the assertions
 * need, then let go.
 */

const buildPath = "/api/imagined-place/build"
const viewports: ReadonlyArray<Viewport> = [desktop, phone]

const demoRegion = (page: Page) => page.getByRole("region", { name: "Imagined place demo" })

/** The phases the paper has been recorded in, in order, one per change. */
const paperPhases = (page: Page) =>
  Effect.map(
    act(() => page.evaluate(recordedPaperFrames)),
    (recorded) => Arr.map(Arr.filter(recorded.split("\n"), Str.isNonEmpty), (line) => line.split(" ")[1] ?? "-")
  )

/** How many searches have landed: a `complete` after each run of trials. */
const landings = (phases: ReadonlyArray<string>): number =>
  Arr.filter(phases, (phase, index) => phase === "complete" && phases[index - 1] !== "complete").length

/**
 * Every region of the demonstration was painted at one height until the
 * drawing first landed — the paper cut in the stand-in before the first frame,
 * as it is cut in the face when that is in hand — and the faces' arrival left
 * every region at the height the first landing left it: the second search,
 * measured in the served face, changed nothing about where the page rests.
 */
const nothingShifted = (page: Page, where: string) =>
  Effect.map(footprintsSoFar(page), (reports) => {
    const heights = heightsByRegion(untilLanding(reports))
    expect(Rec.keys(heights)).toEqual(
      expect.arrayContaining(["step:compose", "step:propose", "step:record", "step:arrange", "stage:column"])
    )
    Arr.forEach(Rec.toEntries(heights), ([region, painted]) => {
      expect(painted, `${where}: ${region}`).toHaveLength(1)
    })
    const { first, second } = aroundSecondSearch(reports)
    const restBefore = restingHeights(first)
    Arr.forEach(Rec.toEntries(restingHeights(second)), ([region, height]) => {
      expect(height, `${where}: ${region} after the faces landed`).toBe(restBefore[region])
    })
  })

layer(Layer.merge(SiteLive, BrowserLive), { excludeTestServices: true, timeout: "3 minutes" })(
  "Theoria homepage typefaces in Chromium",
  (it) => {
    it.scoped("text stands at the served face's metrics before it arrives, the stage is drawn in what the page shows, and the arrival re-measures without moving anything", () =>
      Effect.forEach(viewports, (viewport) =>
        Effect.gen(function*() {
          const where = `${String(viewport.width)}×${String(viewport.height)}`
          const { failures, page } = yield* openPage({ viewport })
          yield* act(() => page.addInitScript(recordFootprints))
          yield* act(() => page.addInitScript(recordPaperFrames))
          yield* act(() => page.addInitScript(recordWebVitals))
          const faces = yield* holdResponses(page, "GET", ".woff2")
          const built = yield* Effect.fork(nextResponse(page, "POST", buildPath))
          // The held faces are preloads, so `load` waits on them; the document parsing is enough to look.
          yield* gotoParsed(page, "/")
          const title = page.getByRole("heading", { level: 1 })
          yield* visible(title)

          // The first paint is in a stand-in: the served faces are still in flight, and every stand-in the
          // stacks name is declared with the served face's ascent, descent and advance.
          const before = yield* act(() => page.evaluate(typefaces, measuredFont("body")))
          expect(before.status, where).toBe("loading")
          expect(before.servedInHand, where).toBe(false)
          expect(before.standIns.length, where).toBeGreaterThanOrEqual(8)
          Arr.forEach(before.standIns, (standIn) => {
            expect(standIn.ascentOverride, `${where}: ${standIn.family}`).not.toBe("normal")
          })
          // This host has the Liberation faces, the metric clones of Arial and Courier New, so the title is set in one.
          expect(
            Arr.some(before.standIns, (standIn) =>
              standIn.family.endsWith("Liberation Sans") && standIn.status === "loaded"),
            where
          ).toBe(true)
          const titleBefore = yield* act(() =>
            title.evaluate(textBlockMetrics)
          )

          // The build back, the stage does not wait for the faces: the story is measured in the stand-in the page
          // shows, the paper cut, and the drawing landed on it.
          yield* Fiber.join(built)
          const paper = demoRegion(page).locator("[data-place-stage='paper']")
          yield* visible(paper)
          yield* eventually(() => demoRegion(page).evaluate(storyDrawn), true)
          yield* count(demoRegion(page).locator("[data-place-stage='uncut']"), 0)
          expect(landings(yield* paperPhases(page)), where).toBe(1)
          const stillInFlight = yield* act(() => page.evaluate(typefaces, measuredFont("body")))
          expect(stillInFlight.servedInHand, where).toBe(false)

          yield* faces.release
          // The faces in hand, the layout is built again in them and the story searched again: a second run of
          // trials, a second landing, on the paper the first cut.
          const after = yield* until(
            act(() => page.evaluate(typefaces, measuredFont("body"))),
            (faces) => faces.status === "loaded",
            `${where}: the faces loaded`
          )
          expect(after.servedInHand, where).toBe(true)
          yield* until(paperPhases(page), (phases) => landings(phases) >= 2, `${where}: a second landing`)
          yield* eventually(() => demoRegion(page).evaluate(storyDrawn), true)
          expect(landings(yield* paperPhases(page)), where).toBe(2)

          // The swap moved nothing: the title's box is the box it was, no region of the demonstration was painted at
          // a second height, and the layout-shift observer saw nothing of the demonstration move.
          expect(yield* act(() => title.evaluate(textBlockMetrics)), where).toEqual(titleBefore)
          yield* nothingShifted(page, where)
          expect(yield* act(() => page.evaluate(recordedDemonstrationShifts)), where).toBe("")
          expect(yield* failures).toEqual([])
        }), { discard: true }))
  }
)
