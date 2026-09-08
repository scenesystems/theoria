// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import type { Page } from "@playwright/test"
import { Effect, Fiber, Layer } from "effect"
import * as Arr from "effect/Array"
import * as Rec from "effect/Record"

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
  type Viewport,
  visible
} from "./browser.js"
import { footprintsUntilLanding, heightsByRegion } from "./footprints.js"
import { recordFootprints, storyDrawn, textBlockMetrics, typefaces } from "./platform/in-page.js"
import { SiteLive } from "./site.js"

/**
 * The page's type, from the first paint to the served faces' arrival. Until
 * they arrive the text is set in a stand-in declared at the served face's
 * metrics, so the swap moves nothing; and nothing is measured for drawing
 * until they are here, so no width the stand-in gave is ever kept. The faces
 * are held at the browser's edge to keep that state for as long as the
 * assertions need, then let go.
 */

const buildPath = "/api/imagined-place/build"
const viewports: ReadonlyArray<Viewport> = [desktop, phone]

const demoRegion = (page: Page) => page.getByRole("region", { name: "Imagined place demo" })

/**
 * Every text region was painted at one height: the faces' arrival moved no
 * text. The stage column alone has two — the placeholder that stood while no
 * line could be measured, then the paper, cut once — and no third: the paper
 * was never recut. The arrange step holds the column, and the legend laid
 * with it where the discs are too small for their names, so it too has two
 * heights and no third.
 */
const nothingShifted = (page: Page, where: string) =>
  Effect.map(footprintsUntilLanding(page), (footprints) => {
    const heights = heightsByRegion(footprints)
    expect(Rec.keys(heights)).toEqual(
      expect.arrayContaining(["step:compose", "step:propose", "step:record", "step:arrange", "stage:column"])
    )
    Arr.forEach(Rec.toEntries(heights), ([region, painted]) => {
      expect(painted, `${where}: ${region}`).toHaveLength(
        region === "stage:column" || region === "step:arrange" ? 2 : 1
      )
    })
  })

layer(Layer.merge(SiteLive, BrowserLive), { excludeTestServices: true, timeout: "3 minutes" })(
  "Theoria homepage typefaces in Chromium",
  (it) => {
    it.scoped("text stands at the served face's metrics before it arrives, the stage waits to measure in it, and its arrival moves nothing", () =>
      Effect.forEach(viewports, (viewport) =>
        Effect.gen(function*() {
          const where = `${String(viewport.width)}×${String(viewport.height)}`
          const { failures, page } = yield* openPage({ viewport })
          yield* act(() => page.addInitScript(recordFootprints))
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

          // The build has come back, and still the stage waits: no line of the story is measured in the stand-in,
          // so the paper is not cut — the placeholder stands where it will be.
          yield* Fiber.join(built)
          const paper = demoRegion(page).locator("[data-place-stage='paper']")
          yield* visible(demoRegion(page).locator("[data-place-stage='uncut']"))
          yield* count(paper, 0)

          yield* faces.release
          // The faces in hand, the story is measured in them and the paper cut once, held until the drawing lands.
          yield* visible(paper)
          yield* eventually(() => demoRegion(page).evaluate(storyDrawn), true)
          const after = yield* act(() => page.evaluate(typefaces, measuredFont("body")))
          expect(after.status, where).toBe("loaded")
          expect(after.servedInHand, where).toBe(true)
          // The swap moved nothing: the title's box is the box it was, and no text region was painted at a second height.
          expect(yield* act(() => title.evaluate(textBlockMetrics)), where).toEqual(titleBefore)
          yield* nothingShifted(page, where)
          expect(yield* failures).toEqual([])
        }), { discard: true }))
  }
)
