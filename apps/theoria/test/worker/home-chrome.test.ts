// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import type { Locator, Page } from "@playwright/test"
import { Numeric } from "@scenesystems/effect-math"
import { Effect, Equal, Layer, Number as Num, Option, Predicate } from "effect"
import * as Arr from "effect/Array"
import { evaluate, evaluateElement, evaluateElements } from "./browser.js"

import { siteMetadata } from "../../app/contracts/metadata.js"
import {
  act,
  attribute,
  BrowserLive,
  click,
  clickAt,
  containsText,
  desktop,
  goto,
  hover,
  openPage,
  phone,
  pointerAway,
  setViewport,
  visible
} from "./browser.js"
import { drawn } from "./demo.js"
import {
  boxOf,
  headerControls,
  mountWrappedBaselineRow,
  pressableCursors,
  textBaselines,
  underlineDrawn,
  unmountWrappedBaselineRow
} from "./platform/in-page.js"
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
  expect(
    Arr.match(distances, {
      onEmpty: () => 0,
      onNonEmpty: (values) => Numeric.abs(Num.subtract(Arr.max(values, Num.Order), Arr.min(values, Num.Order)))
    }),
    message
  ).toBeLessThanOrEqual(1)
}

const baselines = (elements: Locator) => evaluateElements(elements, textBaselines)

const siteNav = (page: Page) => page.getByRole("navigation", { name: "Site" })

/** The theme control's names through its cycle; following the system, it also says which mode that is. */
const followingSystem = /^Following system, currently (light|dark) — switch to light mode$/u
const pinnedLight = "Light mode — switch to dark mode"
const pinnedDark = "Dark mode — follow the system"

layer(Layer.merge(SiteLive, BrowserLive), { excludeTestServices: true, timeout: "3 minutes" })(
  (it) => {
    it.scoped("the baseline instrument reads the line a wrapped value begins on, where its label rests", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: phone })
        yield* goto(page, "/")
        yield* visible(siteNav(page))

        const { lines } = yield* Effect.acquireRelease(
          evaluate(page, mountWrappedBaselineRow),
          () => Effect.orDie(evaluate(page, unmountWrappedBaselineRow))
        )
        expect(lines, "the value takes more than one line").toBeGreaterThan(1)
        const rests = yield* baselines(page.locator("[data-probe-label], [data-probe-value]"))
        expect(rests).toHaveLength(2)
        alike(rests, `a label and the first line of its value rest together, not ${String(rests)}`)
        expect(yield* failures).toEqual([])
      }))

    it.scoped("the header's ways off the page stand equally apart in either theme, each with a glyph and a full hit area", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: desktop })
        yield* goto(page, "/")
        yield* visible(siteNav(page))

        yield* Effect.forEach([desktop, phone], (viewport) =>
          Effect.gen(function*() {
            yield* setViewport(page, viewport)
            yield* visible(siteNav(page).getByRole("link", { name: "Docs" }))
            // Measured following the system, then pinned light, then pinned dark, and left as found.
            yield* Effect.forEach(
              [
                { offered: followingSystem, thenOffered: pinnedLight },
                { offered: pinnedLight, thenOffered: pinnedDark },
                { offered: pinnedDark, thenOffered: followingSystem }
              ],
              ({ offered, thenOffered }) =>
                Effect.gen(function*() {
                  yield* visible(page.getByRole("button", { name: offered }))
                  const controls = yield* evaluateElements(siteNav(page).locator(":scope > *"), headerControls)
                  const at = `at ${String(viewport.width)}px offering "${String(offered)}"`
                  expect(controls.length, `${at}: docs, the repository, the other theme`).toBe(3)
                  const gaps = Arr.zipWith(
                    Arr.drop(controls, 1),
                    Arr.dropRight(controls, 1),
                    (next, previous) => Num.subtract(next.shown.left, previous.shown.right)
                  )
                  alike(gaps, `${at}: the space the reader sees between controls is one space, not ${String(gaps)}`)
                  expect(Arr.every(controls, (control) => control.glyphInk > 0), `${at}: every control has a glyph`)
                    .toBe(true)
                  alike(
                    Arr.map(controls, (control) => control.glyphInk),
                    `${at}: the glyphs are drawn at one size, not ${
                      String(Arr.map(controls, (control) => control.glyphInk))
                    }`
                  )
                  expect(
                    Arr.every(controls, (control) => control.reachesCorners),
                    `${at}: every control takes a press anywhere in a 44px square about its centre`
                  ).toBe(true)
                  // The theme control is a glyph alone, so its hit area is wider than what it shows: press it there.
                  const theme = yield* Option.match(Arr.last(controls), {
                    onNone: () => Effect.dieMessage(`${at}: no theme control`),
                    onSome: Effect.succeed
                  })
                  yield* clickAt(page, { x: Num.sum(theme.centre.x, 21), y: theme.centre.y })
                  yield* visible(page.getByRole("button", { name: thenOffered }))
                })
            )
          }))
        expect(yield* failures).toEqual([])
      }))

    it.scoped("the footer aligns its two desktop rows, stacks centrally on narrow screens, and names the legal company", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: desktop, reducedMotion: "reduce" })
        yield* goto(page, "/")
        yield* drawn(page)
        const footer = page.locator("[data-site-footer]")
        yield* containsText(
          footer,
          `© ${String(siteMetadata.copyrightYear)} ${siteMetadata.legalName}`
        )
        // Centre the whole signature — its cube and wordmark — not the wordmark alone.
        const brand = footer.locator("span:has(> svg)")
        const links = footer.getByRole("navigation", { name: "Footer" })
        const tagline = footer.getByText(siteMetadata.tagline, { exact: true })
        const legal = footer.getByText(`© ${String(siteMetadata.copyrightYear)} ${siteMetadata.legalName}`, {
          exact: true
        })
        const brandBox = yield* evaluateElement(brand, boxOf)
        const linksBox = yield* evaluateElement(links, boxOf)
        alike([brandBox.centreY, linksBox.centreY], "brand and links share a row centre")
        alike(yield* baselines(footer.locator("p")), "tagline and copyright rest on one baseline")

        yield* setViewport(page, phone)
        const rows = yield* Effect.forEach([brand, tagline, links, legal], (row) => evaluateElement(row, boxOf))
        alike(Arr.map(rows, (row) => row.centreX), "the narrow footer has one centred column")
        expect(Arr.every(Arr.zip(rows, Arr.drop(rows, 1)), ([before, after]) => after.top > before.bottom))
          .toBe(true)
        expect(yield* failures).toEqual([])
      }))

    it.scoped("whatever can be pressed wears the hand, however it is rendered", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: desktop })
        yield* goto(page, "/")
        yield* drawn(page)

        const controls = yield* evaluateElement(page.locator("body"), pressableCursors)
        // The page renders its controls every way the rule must reach: a button, a mark set as a div, Base UI's
        // radios and switches as spans, its tabs as buttons in a role. Each kind is present, or the check is hollow.
        const rendered = Arr.dedupe(Arr.map(controls, (control) => control.rendered))
        yield* Effect.forEach(
          ["button", "div[role=button]", "span[role=radio]", "span[role=switch]", "button[role=tab]"],
          (kind) =>
            Effect.sync(() => {
              expect(rendered, `the page renders a control as ${kind}`).toContain(kind)
            })
        )
        const otherwise = Arr.filter(controls, Predicate.not((control) => Equal.equals(control.cursor, "pointer")))
        expect(otherwise, "every pressable control wears the hand").toEqual([])
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
        yield* Effect.forEach(Arr.range(0, Num.decrement(headerCount)), (index) =>
          Effect.gen(function*() {
            const header = headers.nth(index)
            yield* act(() => header.scrollIntoViewIfNeeded())
            const name = yield* act(() => header.locator("button").first().innerText())
            const words = header.locator("button > span, a[href^='/docs/'] > span")
            const rests = yield* baselines(words)
            expect(rests.length, `${name}: a name and at least one package`).toBeGreaterThan(1)
            alike(rests, `${name}: its name and its packages rest on one baseline, not ${String(rests)}`)
            const link = header.locator("a[href^='/docs/']").first()
            yield* pointerAway(page)
            const before = yield* evaluateElement(link, underlineDrawn)
            expect(before.lines, `${name}: no underline until the pointer arrives`).not.toContain("underline")
            yield* hover(link)
            const under = yield* evaluateElement(link, underlineDrawn)
            expect(under.lines, `${name}: the underline arrives under the pointer`).toContain("underline")
            expect(under.position, `${name}: the underline is drawn below the descenders`).toBe("under")
            expect(under.color, `${name}: the underline is drawn in the name's colour`).toBe(under.inkColor)
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
