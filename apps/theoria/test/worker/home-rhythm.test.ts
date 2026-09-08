// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import type { Page } from "@playwright/test"
import { Effect, Layer } from "effect"
import * as Arr from "effect/Array"

import { act, animationsSettled, BrowserLive, goto, openPage, setViewport, visible } from "./browser.js"
import { pageRhythm } from "./platform/in-page.js"
import { SiteLive } from "./site.js"

/**
 * The page has one vertical rhythm, in three steps. Within a step of the
 * story, a header and its body are close. Between the steps — Compose,
 * Propose, Record on the spine, and Arrange above them where the columns are
 * stacked — the space is the same each time and clearly more than any space
 * within a step, so each reads as its own stage and not as a run-on of the
 * one before. Between the regions of the page — the demonstration, how it is
 * built, the footer — the space is the same each time and no less than the
 * space between steps. The rhythm holds at every width; only its size scales.
 */

const rendered = (page: Page) => page.locator("[data-place-render-phase='complete']")

/** How many times the tightest relation within a step the space between steps must be, at least. */
const stepsApart = 3

const rhythm = (page: Page) => act(() => page.evaluate(pageRhythm))

/** Distances that are one distance, allowing the pixel a fluid length rounds to differently along the page. */
const alike = (distances: ReadonlyArray<number>, message: string) => {
  expect(Math.max(...distances) - Math.min(...distances), message).toBeLessThanOrEqual(1)
}

layer(Layer.merge(SiteLive, BrowserLive), { excludeTestServices: true, timeout: "3 minutes" })(
  (it) => {
    it.scoped("the steps of the story stand equally and clearly apart, and the page's regions further, at every width", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 1280, height: 900 } })
        yield* goto(page, "/")
        yield* visible(rendered(page))

        yield* Effect.forEach(Arr.make(390, 820, 1280), (width) =>
          Effect.gen(function*() {
            yield* setViewport(page, { width, height: 900 })
            yield* animationsSettled(page)
            const measured = yield* rhythm(page)
            const at = `at ${String(width)}px`
            expect(measured.withinStep, `${at}: the step's header and body are laid out`).toBeGreaterThan(0)

            const betweenActs = [
              measured.propose.top - measured.compose.bottom,
              measured.record.top - measured.propose.bottom
            ]
            const actGap = Math.min(...betweenActs)
            alike(betweenActs, `${at}: the acts stand equally apart`)
            expect(actGap, `${at}: acts ${String(actGap)}px apart, ${String(measured.withinStep)}px within one`)
              .toBeGreaterThanOrEqual(measured.withinStep * stepsApart)
            // Where the columns are stacked, Arrange is a step above Compose and stands the same distance from it.
            if (width < 1024) {
              alike(
                [measured.compose.top - measured.arrange.bottom, actGap],
                `${at}: Arrange stands apart from Compose`
              )
            }

            // The demonstration's two columns end together; the next region stands off whichever is longer.
            const regionGaps = [
              measured.howItsBuilt.top - measured.columns.bottom,
              measured.footer.top - measured.howItsBuilt.bottom
            ]
            const regionGap = Math.min(...regionGaps)
            alike(regionGaps, `${at}: the regions stand equally apart`)
            expect(regionGap, `${at}: regions ${String(regionGap)}px apart, acts ${String(actGap)}px`)
              .toBeGreaterThanOrEqual(actGap)
          }))
        expect(yield* failures).toEqual([])
      }))
  }
)
