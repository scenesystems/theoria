// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import type { Locator, Page } from "@playwright/test"
import { Effect, Layer } from "effect"
import * as Arr from "effect/Array"
import * as Rec from "effect/Record"

import {
  act,
  attribute,
  BrowserLive,
  click,
  type ColorScheme,
  containsText,
  count,
  disabled,
  eventually,
  goto,
  hidden,
  holdResponse,
  openPage,
  type Viewport,
  visible
} from "./browser.js"
import { footprintsUntilLanding, heightsByRegion } from "./footprints.js"
import { contrastsWithin, recordFootprints, storyDrawn } from "./platform/in-page.js"
import { SiteLive } from "./site.js"

/**
 * The demonstration before the build is here, and when it is not coming. The
 * build is held at the browser's edge, so the pending state is held for as
 * long as the assertions need rather than caught in passing; then let go, or
 * failed. Whatever comes, every region of the demonstration keeps the height
 * it was first painted at: the paper is cut to the sheet the recording says
 * the place will want, the search's rows are the room they will take, and a
 * failure is told in the caption's row — there in every state at one height —
 * so no banner is added above the stage for it.
 */

const buildPath = "/api/imagined-place/build"
const viewports: ReadonlyArray<Viewport> = [{ width: 1440, height: 900 }, { width: 390, height: 844 }]
const colorSchemes: ReadonlyArray<ColorScheme> = ["light", "dark"]
const environments = Arr.flatMap(viewports, (viewport) => Arr.map(colorSchemes, (scheme) => ({ viewport, scheme })))
const describeEnvironment = ({ scheme, viewport }: { readonly viewport: Viewport; readonly scheme: ColorScheme }) =>
  `${String(viewport.width)}×${String(viewport.height)} ${scheme}`

const demoRegion = (page: Page) => page.getByRole("region", { name: "Imagined place demo" })
const paper = (demo: Locator) => demo.locator("[data-place-stage='paper']")
const arrangeStep = (demo: Locator) => demo.locator("[data-place-step='arrange']")

/** WCAG's least contrast for text, and for a graphic that carries meaning. */
const leastTextContrast = 4.5
const leastGraphicContrast = 3

/** Everything visible under `root` reads: the words at AA, the shapes at the graphics' least. */
const readable = (root: Locator, where: string) =>
  Effect.map(act(() => root.evaluate(contrastsWithin)), (measured) => {
    expect(measured.length, `${where}: nothing measured`).toBeGreaterThan(0)
    Arr.forEach(measured, (found) => {
      expect(found.ratio, `${where}: ${found.kind} "${found.name}"`).toBeGreaterThanOrEqual(
        found.kind === "text" ? leastTextContrast : leastGraphicContrast
      )
    })
  })

/** Every region painted so far has been painted at one height. */
const nothingShifted = (page: Page, where: string) =>
  Effect.map(footprintsUntilLanding(page), (footprints) => {
    const heights = heightsByRegion(footprints)
    expect(Rec.keys(heights)).toEqual(
      expect.arrayContaining(["step:compose", "step:propose", "step:record", "step:arrange", "stage:column"])
    )
    Arr.forEach(Rec.toEntries(heights), ([region, painted]) => {
      expect(painted, `${where}: ${region}`).toHaveLength(1)
    })
  })

/** The stage as it waits for the build: the paper busy at its sheet, the search's rows as their room. */
const pendingStage = (demo: Locator) =>
  Effect.gen(function*() {
    yield* visible(paper(demo))
    yield* attribute(paper(demo), "aria-busy", "true")
    yield* attribute(paper(demo), "data-place-stage-wait", "pending")
    yield* attribute(demo.locator("[data-place-trace-pending]"), "aria-busy", "true")
    yield* visible(demo.locator("[data-place-search-caption-pending]"))
    yield* count(demo.getByRole("alert"), 0)
  })

layer(Layer.merge(SiteLive, BrowserLive), { excludeTestServices: true, timeout: "3 minutes" })(
  "Theoria homepage before and without the build in Chromium",
  (it) => {
    it.scoped("while the build is held the demonstration stands at its shape, readable, and the build arriving shifts nothing", () =>
      Effect.forEach(environments, (environment) =>
        Effect.gen(function*() {
          const where = describeEnvironment(environment)
          const { failures, page } = yield* openPage({
            viewport: environment.viewport,
            colorScheme: environment.scheme
          })
          yield* act(() => page.addInitScript(recordFootprints))
          const build = yield* holdResponse(page, "POST", buildPath)
          yield* goto(page, "/")
          const demo = demoRegion(page)
          yield* pendingStage(demo)
          yield* readable(arrangeStep(demo), `${where}, pending`)
          yield* nothingShifted(page, `${where}, pending`)

          yield* build.release
          yield* eventually(() => demo.evaluate(storyDrawn), true)
          yield* hidden(demo.locator("[data-place-search-caption-pending]"))
          yield* nothingShifted(page, `${where}, landed`)
          expect(yield* failures).toEqual([])
        }), { discard: true }))

    it.scoped("a build that fails is told in the caption's row, the paper stops waiting, and trying again waits there too", () =>
      Effect.forEach(environments, (environment) =>
        Effect.gen(function*() {
          const where = describeEnvironment(environment)
          const { failures, page } = yield* openPage({
            viewport: environment.viewport,
            colorScheme: environment.scheme
          })
          yield* act(() => page.addInitScript(recordFootprints))
          const build = yield* holdResponse(page, "POST", buildPath)
          yield* goto(page, "/")
          const demo = demoRegion(page)
          yield* pendingStage(demo)

          // The build fails: one alert, in the search caption's row, and nothing else on the page says so.
          yield* build.fail
          const alert = arrangeStep(demo).getByRole("alert")
          yield* count(alert, 1)
          yield* count(page.getByRole("alert"), 1)
          yield* containsText(alert, "The place could not be built.")
          const again = alert.getByRole("button", { name: "Try again" })
          yield* visible(again)
          yield* count(page.getByText("The place could not be built."), 1)
          yield* hidden(demo.locator("[data-place-search-caption-pending]"))
          // The paper is told nothing is coming: it is not busy, and holds its sheet.
          yield* attribute(paper(demo), "aria-busy", "false")
          yield* attribute(paper(demo), "data-place-stage-wait", "failed")
          yield* attribute(demo.locator("[data-place-trace-pending]"), "aria-busy", "false")
          yield* readable(arrangeStep(demo), `${where}, failed`)
          yield* nothingShifted(page, `${where}, failed`)

          // Asked to build again, the row says so and the button rests; the paper waits again.
          const rebuild = yield* holdResponse(page, "POST", buildPath)
          yield* click(again)
          yield* containsText(alert, "Building the place again.")
          yield* disabled(again)
          yield* attribute(paper(demo), "aria-busy", "true")
          yield* attribute(paper(demo), "data-place-stage-wait", "pending")

          // The build arrives: the failure goes and the drawing lands, nothing having moved.
          yield* rebuild.release
          yield* eventually(() => demo.evaluate(storyDrawn), true)
          yield* count(page.getByRole("alert"), 0)
          yield* nothingShifted(page, `${where}, landed after failure`)
          // The browser reports the request the test failed; nothing else went wrong.
          expect(Arr.filter(yield* failures, (failure) => !failure.includes(buildPath))).toEqual([])
        }), { discard: true }))
  }
)
