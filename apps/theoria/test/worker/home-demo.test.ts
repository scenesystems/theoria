// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import type { Locator, Page } from "@playwright/test"
import { Effect, Layer, Option } from "effect"
import * as Arr from "effect/Array"

import { renderTrials } from "../../app/contracts/demo/imagined-place-arrangement.js"
import { placeStepDefinitions } from "../../app/web/view/home/placeSteps.js"
import {
  act,
  attached,
  attribute,
  BrowserLive,
  click,
  containsText,
  count,
  eventually,
  fitsViewport,
  focus,
  goto,
  hover,
  openPage,
  overflowingElements,
  press,
  setViewport,
  visible
} from "./browser.js"
import { SiteLive } from "./site.js"

const rendered = (page: Page) => page.locator("[data-place-render-phase='complete']")

/** Every disc's position relative to the stage, so scrolling cannot move it. */
const markerPositions = (page: Page) => () =>
  page.locator("[data-place-marker]").evaluateAll((markers) => {
    const stage = document.querySelector("[data-place-stage='content']")?.getBoundingClientRect()
    return markers
      .map((marker) => {
        const rect = marker.getBoundingClientRect()
        return `${String(Math.round(rect.x - (stage?.x ?? 0)))},${String(Math.round(rect.y - (stage?.y ?? 0)))}`
      })
      .join(" ")
  })

const referenceTargets = (references: Locator) =>
  Effect.gen(function*() {
    const total = yield* act(() => references.count())
    expect(total).toBeGreaterThan(0)
    return yield* Effect.forEach(Arr.range(0, total - 1), (index) =>
      Effect.gen(function*() {
        const reference = references.nth(index)
        const text = Option.fromNullable(yield* act(() => reference.getAttribute("data-place-reference")))
        const href = Option.fromNullable(yield* act(() => reference.getAttribute("href")))
        return Option.getOrThrow(Option.all({ text, href }))
      }))
  })

layer(Layer.merge(SiteLive, BrowserLive), { excludeTestServices: true, timeout: "3 minutes" })(
  "Theoria home page demo in Chromium",
  (it) => {
    it.scoped("the search trace draws any trial, returns to the kept one, and content IDs open in full", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 390, height: 844 } })
        yield* goto(page, "/")
        yield* visible(rendered(page))
        yield* count(page.locator("[data-place-step]"), placeStepDefinitions.length)
        yield* visible(page.locator("[data-place-marker]").first())

        const caption = page.locator("[data-place-search-caption]")
        yield* containsText(caption, "Kept trial")
        const positions = markerPositions(page)
        const kept = yield* act(positions)
        // The sheet and the slider under the pointer must not move while trials are swapped.
        const paper = page.locator("[data-place-stage='paper']")
        const layout = () =>
          page.evaluate(() => {
            const rect = (selector: string) => document.querySelector(selector)?.getBoundingClientRect()
            const sheet = rect("[data-place-stage='paper']")
            const trace = rect("[data-place-trace]")
            return `${String(Math.round(sheet?.height ?? -1))} ${String(Math.round(trace?.top ?? -1))}`
          })
        yield* focus(page.getByRole("slider", { name: "Trial drawn on the stage" }))
        // Focusing scrolls the slider into view; from here on nothing may move it.
        const atRest = yield* act(layout)
        yield* press(page, "Home")
        yield* containsText(caption, "Trial 1 of")
        yield* containsText(caption, "not kept")
        expect(yield* act(positions)).not.toBe(kept)
        expect(yield* act(layout)).toBe(atRest)
        // Trial 1 runs longer than the kept sheet: it is cut with a fade and scrolls, never clipped silently.
        yield* attribute(paper, "data-overflow-y-end", "")

        yield* press(page, "End")
        yield* containsText(caption, `Trial ${String(renderTrials)} of ${String(renderTrials)}`)
        expect(yield* act(layout)).toBe(atRest)
        yield* press(page, "Escape")
        yield* eventually(() => paper.evaluate((element) => element.hasAttribute("data-has-overflow-y")), false)
        yield* containsText(caption, "Kept trial")
        yield* count(page.locator("[data-place-show-kept]"), 0)

        yield* press(page, "Home")
        yield* click(page.locator("[data-place-show-kept]"))
        yield* containsText(caption, "Kept trial")
        yield* eventually(positions, kept)

        const contentId = page.locator("[data-place-content-id]").first()
        yield* hover(contentId)
        yield* attribute(contentId, "data-popup-open", "")
        yield* visible(page.getByText("Click to copy"))
        expect(yield* failures).toEqual([])
      }))

    it.scoped("nothing on the home page leaks past the viewport at any width", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 390, height: 844 } })
        yield* goto(page, "/")
        yield* visible(rendered(page))
        yield* Effect.forEach([320, 390, 820, 1280, 1680], (width) =>
          Effect.gen(function*() {
            yield* setViewport(page, { width, height: 900 })
            yield* visible(rendered(page))
            expect(yield* overflowingElements(page)).toEqual([])
            expect(yield* fitsViewport(page)).toBe(true)
          }))
        expect(yield* failures).toEqual([])
      }))

    it.scoped("how it's built links every symbol to an existing reference anchor and shows values from the build", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* goto(page, "/")
        yield* visible(rendered(page))

        const section = page.locator("[data-place-how-its-built]")
        yield* attribute(section.locator("[data-place-commit]"), "href", /github\.com\/scenesystems\/theoria\/tree\//u)

        const targets = yield* Effect.forEach(placeStepDefinitions, (step) =>
          Effect.gen(function*() {
            yield* click(section.getByRole("navigation").getByRole("button", { name: step.name }))
            yield* visible(section.locator(`[data-place-code-step='${step.id}']`))
            yield* visible(section.locator("[data-code-annotation]").first())
            yield* attribute(
              section.locator("[data-place-source]").first(),
              "href",
              /github\.com\/scenesystems\/theoria\/blob\//u
            )
            const found = yield* referenceTargets(section.locator("[data-place-reference]"))
            yield* Effect.forEach(found, ({ href, text }) =>
              attribute(section.locator(`[data-code-link='${text}']`).first(), "href", href))
            return found
          }))

        // Playwright names the missing locator on failure, so the anchor id is the message.
        yield* Effect.forEach(Arr.flatten(targets), ({ href }) =>
          Effect.gen(function*() {
            yield* goto(page, href)
            yield* attached(page.locator(`#${href.slice(href.indexOf("#") + 1)}`))
          }))
        expect(yield* failures).toEqual([])
      }))
  }
)
