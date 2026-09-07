// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import type { Page } from "@playwright/test"
import { Effect, Layer } from "effect"
import * as Arr from "effect/Array"

import {
  act,
  BrowserLive,
  eventually,
  fitsViewport,
  focus,
  goto,
  hidden,
  openPage,
  press,
  setViewport,
  until,
  visible
} from "./browser.js"
import {
  focusedControlIntersectsBand,
  insideViewportRight,
  scrollPast,
  surfaceBudget,
  textBlockMetrics
} from "./platform/in-page.js"
import { SiteLive } from "./site.js"

const rendered = "[data-place-render-phase='complete']"
const waitForRendered = (page: Page) => eventually(() => page.locator(rendered).isVisible(), true)

layer(Layer.merge(SiteLive, BrowserLive), { excludeTestServices: true, timeout: "2 minutes" })(
  "Theoria home surface budget and reflow in Chromium",
  (it) => {
    it.scoped("the home page keeps its painted surfaces within the de-carding budget", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 1440, height: 900 } })
        yield* goto(page, "/")
        yield* waitForRendered(page)
        const budget = yield* act(() => page.locator("main").evaluate(surfaceBudget))
        expect(budget.enclosures.length, budget.enclosures.join("\n")).toBeLessThanOrEqual(10)
        expect(budget.dropShadows.length, budget.dropShadows.join("\n")).toBeLessThanOrEqual(4)
        expect(budget.deepestEnclosureChain).toBeLessThanOrEqual(2)
        expect(yield* failures).toEqual([])
      }))

    it.scoped("a proposal's title stands on one line when its column has the room", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 1440, height: 900 } })
        yield* goto(page, "/")
        yield* waitForRendered(page)
        const titles = page.locator("[data-place-proposal] h3")
        const total = yield* act(() => titles.count())
        expect(total).toBeGreaterThan(0)
        yield* Effect.forEach(Arr.range(0, total - 1), (index) =>
          Effect.map(
            act(() => titles.nth(index).evaluate(textBlockMetrics)),
            // One line of words plus the mark's own padding: never a second line.
            (title) => expect(title.height).toBeLessThan(2 * title.lineHeight)
          ))
        expect(yield* failures).toEqual([])
      }))

    it.scoped("at 320 the paper and story chooser fit the viewport", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 390, height: 844 } })
        yield* goto(page, "/")
        yield* waitForRendered(page)
        yield* setViewport(page, { width: 320, height: 700 })
        expect(
          yield* act(() =>
            page.locator("[data-place-stage='paper']").evaluate((node) => node.getBoundingClientRect().width)
          )
        )
          .toBeGreaterThanOrEqual(240)
        expect(yield* fitsViewport(page)).toBe(true)
        const stories = page.getByRole("radiogroup", { name: "Scenario" })
        expect(yield* act(() => stories.evaluate(insideViewportRight))).toBe(true)
        const radios = stories.getByRole("radio")
        yield* Effect.forEach(Arr.range(0, (yield* act(() => radios.count())) - 1), (index) =>
          Effect.map(
            act(() => radios.nth(index).evaluate(insideViewportRight)),
            (inside) => expect(inside).toBe(true)
          ))
        expect(yield* failures).toEqual([])
      }))

    it.scoped("the 200 percent reflow equivalent fits and focus clears the pinned band", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ reducedMotion: "reduce" })
        yield* goto(page, "/")
        yield* waitForRendered(page)
        yield* setViewport(page, { width: 640, height: 360 })
        expect(yield* fitsViewport(page)).toBe(true)
        const title = yield* act(() => page.locator("h1").evaluate(textBlockMetrics))
        expect(title.height).toBeLessThanOrEqual(3 * title.lineHeight)
        yield* act(() => page.locator("[data-place-stage='paper']").evaluate(scrollPast))
        yield* visible(page.locator("[data-place-band]"))
        const controls = page.getByRole("switch").or(
          page.getByRole("radiogroup", { name: "Scenario" }).getByRole("radio")
        )
        yield* Effect.forEach(Arr.range(0, (yield* act(() => controls.count())) - 1), (index) =>
          Effect.gen(function*() {
            yield* focus(controls.nth(index))
            expect(yield* act(() => page.evaluate(focusedControlIntersectsBand))).toBe(false)
          }))
        expect(yield* failures).toEqual([])
      }))

    it.scoped("at 390 reduced motion a keyboard merge changes the prose and every marker answers", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" })
        yield* goto(page, "/")
        yield* waitForRendered(page)
        const lines = page.locator("[data-place-line]")
        const before = yield* act(() => lines.allInnerTexts())
        const merge = page.getByRole("switch", { checked: false, name: /^Merge Ship's bell/u })
        yield* focus(merge)
        yield* press(page, "Space")
        const after = yield* until(
          act(() => lines.allInnerTexts()),
          (text) => text.join(" ") !== before.join(" "),
          "the merged proposal changes the prose"
        )
        expect(after.join(" ")).not.toBe(before.join(" "))
        yield* visible(page.getByRole("button", { name: /^Ship's bell, added by proposer program/u }))
        const markers = page.locator("[data-place-marker]")
        const overlay = page.locator("[data-place-provenance]")
        yield* Effect.forEach(Arr.range(0, (yield* act(() => markers.count())) - 1), (index) =>
          Effect.gen(function*() {
            yield* focus(markers.nth(index))
            yield* press(page, "Enter")
            yield* visible(overlay)
            yield* press(page, "Escape")
            yield* hidden(overlay)
          }))
        expect(yield* failures).toEqual([])
      }))
  }
)
