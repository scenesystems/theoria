// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import type { Page } from "@playwright/test"
import { Effect, Fiber, Layer, Schema } from "effect"

import { webVitalBudgets } from "../../app/contracts/performance.js"
import { act, animationsSettled, BrowserLive, click, goto, nextResponse, openPage, visible } from "./browser.js"
import { recordedDemonstrationShifts, recordedWebVitals, recordWebVitals } from "./platform/in-page.js"
import { SiteLive } from "./site.js"

const WebVitals = Schema.Tuple(Schema.NumberFromString, Schema.NumberFromString, Schema.NumberFromString)
const viewports = [{ width: 1440, height: 900 }, { width: 390, height: 844 }]
const rendered = (page: Page) => page.locator("[data-place-render-phase='complete']")

const readVitals = (page: Page) =>
  Effect.flatMap(
    act(() => page.evaluate(recordedWebVitals)),
    (reported) => Schema.decodeUnknown(WebVitals)(reported.split(" "))
  )

layer(Layer.merge(SiteLive, BrowserLive), { excludeTestServices: true, timeout: "2 minutes" })(
  "Theoria homepage web vitals in Chromium",
  (it) => {
    it.scoped("the homepage's first paint stays within its vitals budgets", () =>
      Effect.forEach(viewports, (viewport) =>
        Effect.gen(function*() {
          const { failures, page } = yield* openPage({ viewport })
          yield* act(() => page.addInitScript(recordWebVitals))
          yield* goto(page, "/")
          yield* visible(rendered(page))
          yield* animationsSettled(page)
          const [lcp, cls] = yield* readVitals(page)
          expect(lcp).toBeLessThanOrEqual(webVitalBudgets.lcpMs)
          expect(cls).toBeLessThanOrEqual(webVitalBudgets.cls)
          // The demonstration's placeholders stand at the height of what they stand in for: its own loading shifts nothing.
          expect(yield* act(() => page.evaluate(recordedDemonstrationShifts))).toBe("")
          expect(yield* failures).toEqual([])
        })))

    it.scoped("an interaction while the search runs stays within the INP budget", () =>
      Effect.forEach(viewports, (viewport) =>
        Effect.gen(function*() {
          const { failures, page } = yield* openPage({ viewport })
          yield* act(() => page.addInitScript(recordWebVitals))
          yield* goto(page, "/")
          yield* visible(rendered(page))
          yield* animationsSettled(page)
          // The story change is the interaction; the search it starts is the work the page must stay responsive through.
          const scenarios = page.getByRole("radiogroup", { name: "Scenario" })
          const rebuild = yield* Effect.fork(nextResponse(page, "POST", "/api/imagined-place/build"))
          yield* click(scenarios.getByRole("radio", { checked: false }).first())
          expect((yield* Fiber.join(rebuild)).status()).toBe(200)
          yield* visible(rendered(page))
          yield* animationsSettled(page)
          const [, , inp] = yield* readVitals(page)
          expect(inp).toBeLessThanOrEqual(webVitalBudgets.inpMs)
          expect(yield* failures).toEqual([])
        })))
  }
)
