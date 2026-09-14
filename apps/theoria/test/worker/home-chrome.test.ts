// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import type { Locator, Page } from "@playwright/test"
import { Effect, Layer } from "effect"
import * as Arr from "effect/Array"

import { siteMetadata } from "../../app/contracts/metadata.js"
import {
  act,
  attribute,
  BrowserLive,
  click,
  containsText,
  desktop,
  goto,
  openPage,
  phone,
  setViewport,
  visible
} from "./browser.js"
import { drawn } from "./demo.js"
import { headerControls, textBaselines, underlinePosition } from "./platform/in-page.js"
import { SiteLive } from "./site.js"

/**
 * The page's chrome and its small type, set as one hand would set them. The
 * header's ways off the page stand equally apart as the reader sees them,
 * each with a glyph, each as easy to press as the others. Wherever a label is
 * set beside words in another face — a step's name beside its packages, an
 * answer's fact beside its value, a call beside its copy — the two rest on
 * one baseline, and an underline that arrives under a package's name is drawn
 * below its descenders, not through them. The footer names the company as it
 * is incorporated.
 */

/** Distances that are one distance, allowing the pixel a fluid length rounds to differently along the line. */
const alike = (distances: ReadonlyArray<number>, message: string) => {
  expect(Math.max(...distances) - Math.min(...distances), message).toBeLessThanOrEqual(1)
}

const baselines = (elements: Locator) => act(() => elements.evaluateAll(textBaselines))

const siteNav = (page: Page) => page.getByRole("navigation", { name: "Site" })

layer(Layer.merge(SiteLive, BrowserLive), { excludeTestServices: true, timeout: "3 minutes" })(
  (it) => {
    it.scoped("the header's ways off the page stand equally apart, each with a glyph and a full hit area", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: desktop })
        yield* goto(page, "/")
        yield* visible(siteNav(page))

        yield* Effect.forEach([desktop, phone], (viewport) =>
          Effect.gen(function*() {
            yield* setViewport(page, viewport)
            const controls = yield* act(() => siteNav(page).locator(":scope > *").evaluateAll(headerControls))
            const at = `at ${String(viewport.width)}px`
            expect(controls.length, `${at}: docs, the repository, the other theme`).toBe(3)
            const gaps = Arr.zipWith(
              Arr.drop(controls, 1),
              Arr.dropRight(controls, 1),
              (next, previous) => next.shown.left - previous.shown.right
            )
            alike(gaps, `${at}: the space the reader sees between controls is one space, not ${String(gaps)}`)
            expect(Arr.every(controls, (control) => control.glyphInk > 0), `${at}: every control has a glyph`).toBe(
              true
            )
            alike(
              Arr.map(controls, (control) => control.glyphInk),
              `${at}: the glyphs are drawn at one size, not ${String(controls.map((control) => control.glyphInk))}`
            )
            expect(
              Arr.every(controls, (control) => control.reaches.left && control.reaches.right),
              `${at}: every control is at least 44px wide to a press`
            ).toBe(true)
          }))
        expect(yield* failures).toEqual([])
      }))

    it.scoped("the footer names the company as it is incorporated", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* goto(page, "/")
        yield* containsText(
          page.locator("[data-site-footer]"),
          `© ${String(siteMetadata.copyrightYear)} ${siteMetadata.legalName}`
        )
        expect(yield* failures).toEqual([])
      }))

    it.scoped("a step's name and its packages rest on one baseline, and a package's underline is drawn below its descenders", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: desktop })
        yield* goto(page, "/")
        yield* drawn(page)

        const headers = page.locator("[data-place-step-header]")
        const headerCount = yield* act(() => headers.count())
        expect(headerCount).toBeGreaterThan(0)
        yield* Effect.forEach(Arr.range(0, headerCount - 1), (index) =>
          Effect.gen(function*() {
            const header = headers.nth(index)
            yield* act(() => header.scrollIntoViewIfNeeded())
            const name = yield* act(() => header.locator("button").first().innerText())
            const words = header.locator("button > span, a[href^='/docs/'] > span")
            const rests = yield* baselines(words)
            expect(rests.length, `${name}: a name and at least one package`).toBeGreaterThan(1)
            alike(rests, `${name}: its name and its packages rest on one baseline, not ${String(rests)}`)
            const underline = yield* act(() => header.locator("a[href^='/docs/']").first().evaluate(underlinePosition))
            expect(underline, `${name}: the underline is drawn below the descenders`).toBe("under")
          }))
        expect(yield* failures).toEqual([])
      }))

    it.scoped("an answer's facts rest label with value on one baseline, and its call with its copy", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: desktop })
        yield* goto(page, "/")
        yield* drawn(page)
        const demo = page.getByRole("region", { name: "Imagined place demo" })
        const overlay = page.locator("[data-place-provenance]")

        const mark = demo.locator("[data-provenance*='Digest']").first()
        yield* act(() => mark.scrollIntoViewIfNeeded())
        yield* click(mark)
        yield* attribute(mark, "data-popup-open", "")
        yield* visible(overlay)
        const answer = overlay.locator("[data-current]")

        const labels = yield* baselines(answer.locator("dt"))
        const values = yield* baselines(answer.locator("dd"))
        expect(labels.length, "the answer states facts").toBeGreaterThan(0)
        expect(values.length).toBe(labels.length)
        Arr.zipWith(labels, values, (label, value) => alike([label, value], "a fact's label rests with its value"))

        const footer = yield* baselines(
          answer.locator("[data-place-provenance-code] > code, [data-place-provenance-copy] > span")
        )
        expect(footer.length, "the call that made it and the copy of it").toBe(2)
        alike(footer, `the call and its copy rest on one baseline, not ${String(footer)}`)
        expect(yield* failures).toEqual([])
      }))
  }
)
