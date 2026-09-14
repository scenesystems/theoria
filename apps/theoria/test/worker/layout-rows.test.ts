// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import type { Locator } from "@playwright/test"
import { Effect, Layer } from "effect"
import * as Arr from "effect/Array"

import { act, BrowserLive, desktop, goto, openPage, visible } from "./browser.js"
import { boxEdges } from "./platform/in-page.js"
import { SiteLive } from "./site.js"

/**
 * A row rests its items where it was asked to, as the stylesheet draws them.
 * The header's wordmark and its ways off the page are not one height, yet
 * centre on one line; a signature's return type and the words about it are
 * not one height, yet start on one line. Baseline rows are measured with the
 * page's small type in home-chrome.
 */

/** Distances that are one distance, allowing the pixel a fluid length rounds to differently along the line. */
const alike = (distances: ReadonlyArray<number>, message: string) => {
  expect(Math.max(...distances) - Math.min(...distances), message).toBeLessThanOrEqual(1)
}

/** Distances that are not one distance: the row, not the items, decides where the items rest. */
const unalike = (distances: ReadonlyArray<number>, message: string) => {
  expect(Math.max(...distances) - Math.min(...distances), message).toBeGreaterThan(1)
}

const edges = (elements: Locator) => act(() => elements.evaluateAll(boxEdges))
const height = (box: { readonly top: number; readonly bottom: number }) => box.bottom - box.top
const centre = (box: { readonly top: number; readonly bottom: number }) => (box.top + box.bottom) / 2

layer(Layer.merge(SiteLive, BrowserLive), { excludeTestServices: true, timeout: "2 minutes" })(
  (it) => {
    it.scoped("the header centres its wordmark and its ways off the page on one line, though they differ in height", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: desktop })
        yield* goto(page, "/")
        const nav = page.getByRole("navigation", { name: "Site" })
        yield* visible(nav)

        const boxes = yield* edges(nav.locator("xpath=..").locator(":scope > *"))
        expect(boxes.length, "the wordmark and the ways").toBe(2)
        unalike(Arr.map(boxes, height), "the wordmark and the ways differ in height")
        alike(
          Arr.map(boxes, centre),
          `the wordmark and the ways centre on one line, not ${String(Arr.map(boxes, centre))}`
        )
        expect(yield* failures).toEqual([])
      }))

    it.scoped("a signature's return type and the words about it start on one line, though they differ in height", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: desktop })
        yield* goto(page, "/docs/effect-dsp/api/Optimizer#api-progress")
        yield* visible(page.getByRole("heading", { level: 1, name: "progress" }))

        const returns = page.locator("main").getByText("Returns", { exact: true }).first()
        yield* act(() => returns.scrollIntoViewIfNeeded())
        const boxes = yield* edges(returns.locator("xpath=following-sibling::*[1]").locator(":scope > *"))
        expect(boxes.length, "the type and the words about it").toBe(2)
        unalike(Arr.map(boxes, height), "the type and the words differ in height")
        alike(
          Arr.map(boxes, (box) => box.top),
          `the type and the words start on one line, not ${String(Arr.map(boxes, (box) => box.top))}`
        )
        expect(yield* failures).toEqual([])
      }))
  }
)
