// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import type { Locator } from "@playwright/test"
import { Numeric } from "@scenesystems/effect-math"
import { Effect, Layer, Number as Num, Schema } from "effect"
import * as Arr from "effect/Array"

import { evaluateElements } from "./browser.js"
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
  expect(
    Arr.match(distances, {
      onEmpty: () => 0,
      onNonEmpty: (values) => Numeric.abs(Num.subtract(Arr.max(values, Num.Order), Arr.min(values, Num.Order)))
    }),
    message
  ).toBeLessThanOrEqual(1)
}

/** Distances that are not one distance: the row, not the items, decides where the items rest. */
const unalike = (distances: ReadonlyArray<number>, message: string) => {
  expect(
    Arr.match(distances, {
      onEmpty: () => 0,
      onNonEmpty: (values) => Numeric.abs(Num.subtract(Arr.max(values, Num.Order), Arr.min(values, Num.Order)))
    }),
    message
  ).toBeGreaterThan(1)
}

const edges = (elements: Locator) => evaluateElements(elements, boxEdges)
const height = (box: { readonly top: number; readonly bottom: number }) => Num.subtract(box.bottom, box.top)
const centre = (box: { readonly top: number; readonly bottom: number }) =>
  Num.unsafeDivide(Num.sum(box.top, box.bottom), 2)

layer(Layer.merge(SiteLive, BrowserLive), { excludeTestServices: true, timeout: "2 minutes" })(
  (it) => {
    it.scoped("the header centres its wordmark and its ways off the page on one line, though they differ in height", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: desktop })
        yield* goto(page, "/")
        const nav = page.getByRole("navigation", { name: "Site" })
        yield* visible(nav)

        // The brand link and navigation both have 44px hit areas; measure the visible wordmark inside its link.
        const wordmark = page.locator("header a[href='/'] > span")
        yield* visible(wordmark)
        const boxes = yield* edges(wordmark.or(nav))
        expect(Arr.length(boxes), "the wordmark and the ways").toBe(2)
        unalike(Arr.map(boxes, height), "the wordmark and the ways differ in height")
        alike(
          Arr.map(boxes, centre),
          `the wordmark and the ways centre on one line, not ${
            Arr.join(
              Arr.map(boxes, (box) => Schema.encodeSync(Schema.NumberFromString)(centre(box))),
              ", "
            )
          }`
        )
        expect(yield* failures).toEqual([])
      }))

    it.scoped("a signature's return type and the words about it start on one line, though they differ in height", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: desktop })
        yield* goto(page, "/docs/effect-math/api/Statistics#api-mean")
        yield* visible(page.getByRole("heading", { level: 1, name: "mean" }))

        const returns = page.locator("main").getByText("Returns", { exact: true }).first()
        yield* act(() => returns.scrollIntoViewIfNeeded())
        const boxes = yield* edges(returns.locator("xpath=following-sibling::*[1]").locator(":scope > *"))
        expect(Arr.length(boxes), "the type and the words about it").toBe(2)
        unalike(Arr.map(boxes, height), "the type and the words differ in height")
        alike(
          Arr.map(boxes, (box) => box.top),
          `the type and the words start on one line, not ${
            Arr.join(
              Arr.map(boxes, (box) => Schema.encodeSync(Schema.NumberFromString)(box.top)),
              ", "
            )
          }`
        )
        expect(yield* failures).toEqual([])
      }))
  }
)
