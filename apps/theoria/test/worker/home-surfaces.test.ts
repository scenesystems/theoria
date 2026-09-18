// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import { Boolean as Bool, Effect, Layer, Number as Num, String as Str } from "effect"
import * as Arr from "effect/Array"
import { evaluate, evaluateElement } from "./browser.js"

import {
  act,
  BrowserLive,
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
import { drawn, searchSettlesWithin } from "./demo.js"
import {
  boxWidth,
  focusedControlIntersectsBand,
  fullyInViewport,
  insideViewportRight,
  scrollPast,
  scrollToTop,
  surfaceBudget,
  textBlockMetrics,
  topEdgeInViewport
} from "./platform/in-page.js"
import { SiteLive } from "./site.js"

layer(Layer.merge(SiteLive, BrowserLive), { excludeTestServices: true, timeout: "2 minutes" })(
  "Theoria home surface budget and reflow in Chromium",
  (it) => {
    it.scoped("the home page keeps its painted surfaces within the de-carding budget", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 1440, height: 900 } })
        yield* goto(page, "/")
        yield* drawn(page)
        const budget = yield* evaluateElement(page.locator("main"), surfaceBudget)
        expect(Arr.length(budget.enclosures), Arr.join(budget.enclosures, "\n")).toBeLessThanOrEqual(10)
        expect(Arr.length(budget.dropShadows), Arr.join(budget.dropShadows, "\n")).toBeLessThanOrEqual(4)
        expect(budget.deepestEnclosureChain).toBeLessThanOrEqual(2)
        expect(yield* failures).toEqual([])
      }))

    it.scoped("a proposal's title stands on one line when its column has the room", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 1440, height: 900 } })
        yield* goto(page, "/")
        yield* drawn(page)
        const titles = page.locator("[data-place-proposal] h3")
        const total = yield* act(() => titles.count())
        expect(total).toBeGreaterThan(0)
        yield* Effect.forEach(Arr.range(0, Num.decrement(total)), (index) =>
          Effect.map(
            evaluateElement(titles.nth(index), textBlockMetrics),
            // One line of words plus the mark's own padding: never a second line.
            (title) => expect(title.height).toBeLessThan(Num.multiply(2, title.lineHeight))
          ))
        expect(yield* failures).toEqual([])
      }))

    it.scoped("at 320 the paper and story chooser fit the viewport", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 390, height: 844 } })
        yield* goto(page, "/")
        yield* drawn(page)
        yield* setViewport(page, { width: 320, height: 700 })
        expect(
          yield* evaluateElement(page.locator("[data-place-stage='paper']"), boxWidth)
        )
          .toBeGreaterThanOrEqual(240)
        expect(yield* fitsViewport(page)).toBe(true)
        const stories = page.getByRole("radiogroup", { name: "Scenario" })
        expect(yield* evaluateElement(stories, insideViewportRight)).toBe(true)
        const radios = stories.getByRole("radio")
        yield* Effect.forEach(Arr.range(0, Num.decrement(yield* act(() => radios.count()))), (index) =>
          Effect.map(
            evaluateElement(radios.nth(index), insideViewportRight),
            (inside) => expect(inside).toBe(true)
          ))
        expect(yield* failures).toEqual([])
      }))

    it.scoped("the 200 percent reflow equivalent fits and focus clears the pinned band", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ reducedMotion: "reduce" })
        yield* goto(page, "/")
        yield* drawn(page)
        yield* setViewport(page, { width: 640, height: 360 })
        expect(yield* fitsViewport(page)).toBe(true)
        const title = yield* evaluateElement(page.locator("h1"), textBlockMetrics)
        expect(title.height).toBeLessThanOrEqual(Num.multiply(3, title.lineHeight))
        yield* evaluateElement(page.locator("[data-place-stage='paper']"), scrollPast)
        yield* visible(page.locator("[data-place-band]"))
        const controls = page.getByRole("switch").or(
          page.getByRole("radiogroup", { name: "Scenario" }).getByRole("radio")
        )
        yield* Effect.forEach(Arr.range(0, Num.decrement(yield* act(() => controls.count()))), (index) =>
          Effect.gen(function*() {
            yield* focus(controls.nth(index))
            expect(yield* evaluate(page, focusedControlIntersectsBand)).toBe(false)
          }))
        expect(yield* failures).toEqual([])
      }))

    it.scoped("at 390 reduced motion a keyboard merge changes the prose and every marker answers", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" })
        yield* goto(page, "/")
        yield* drawn(page)
        // Before any scroll the place and its current version are in view: the paper's top edge and the
        // version the stage shows, under the Arrange header. (The first disc is the drawing's own: the
        // search puts it ≈90 px into the paper at this width, so it is the next scroll's, not forced up.)
        yield* evaluate(page, scrollToTop)
        expect(yield* evaluateElement(page.locator("[data-place-stage='paper']"), topEdgeInViewport)).toBe(true)
        expect(yield* evaluateElement(page.locator("[data-place-current-version]"), fullyInViewport)).toBe(true)
        const lines = page.locator("[data-place-line]")
        const before = yield* act(() => lines.allInnerTexts())
        const merge = page.getByRole("switch", { checked: false, name: /^Merge Ship's bell/u })
        yield* focus(merge)
        yield* press(page, "Space")
        const after = yield* until(
          act(() => lines.allInnerTexts()),
          (text) => Bool.not(Str.Equivalence(Arr.join(text, " "), Arr.join(before, " "))),
          "the merged proposal changes the prose",
          searchSettlesWithin
        )
        expect(Arr.join(after, " ")).not.toBe(Arr.join(before, " "))
        // Prose changes during the search; new feature controls arrive only after its drawing settles.
        yield* drawn(page)
        yield* visible(page.getByRole("button", { name: /^Ship's bell, added by proposer program/u }))
        const markers = page.locator("[data-place-marker]")
        const overlay = page.locator("[data-place-provenance]")
        yield* Effect.forEach(
          Arr.range(0, Num.decrement(yield* act(() => markers.count()))),
          (index) =>
            Effect.gen(function*() {
              yield* focus(markers.nth(index))
              yield* press(page, "Enter")
              yield* visible(overlay)
              yield* press(page, "Escape")
              yield* hidden(overlay)
            })
        )
        expect(yield* failures).toEqual([])
      }))
  }
)
