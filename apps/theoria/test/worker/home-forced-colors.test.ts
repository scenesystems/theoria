// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import type { Locator, Page } from "@playwright/test"
import { Effect, Layer, Order } from "effect"
import * as Arr from "effect/Array"

import type { ColorScheme } from "./browser.js"
import {
  act,
  animationsSettled,
  BrowserLive,
  click,
  eventually,
  focus,
  goto,
  hover,
  openPage,
  press,
  visible
} from "./browser.js"
import { backgroundColour, edgesOf, systemColour, textColour } from "./platform/in-page.js"
import { SiteLive } from "./site.js"

/**
 * Under forced colours (Windows High Contrast) the browser repaints every
 * author colour from the system palette and drops box shadows and background
 * images. Every state the page shows must still be seen: it is said in system
 * colours the browser honours — `Canvas`, `CanvasText`, `Highlight`,
 * `HighlightText` — with `forced-colors:` variants, never by opting a surface
 * out of the adjustment. Each check runs in the light and the dark palette,
 * and compares against a probe of the named system colour on the same page,
 * not a literal, because the palettes differ.
 */
const colorSchemes: ReadonlyArray<ColorScheme> = ["light", "dark"]
const rendered = (page: Page) => page.locator("[data-place-render-phase='complete']")
const colour = (locator: Locator) => act(() => locator.evaluate(backgroundColour))
const system = (page: Page, name: string) => act(() => page.evaluate(systemColour, name))
const edges = (locator: Locator) => act(() => locator.evaluateAll(edgesOf))
const edge = (locator: Locator) =>
  Effect.map(edges(locator), (found) => found[0] ?? { outline: absent, border: absent })
const absent = { color: "", style: "none", width: 0 }
// The program's proposal is the one unmerged at first sight; scoping by its
// proposer keeps the locator stable through the merge.
const mergeSwitch = (page: Page, checked: boolean) =>
  page.locator("[data-place-proposal='program']").getByRole("switch", { checked })

const inForcedColors = (check: (page: Page) => Effect.Effect<void, unknown>) =>
  Effect.forEach(colorSchemes, (scheme) =>
    Effect.gen(function*() {
      const { failures, page } = yield* openPage({ colorScheme: scheme, forcedColors: "active" })
      yield* goto(page, "/")
      yield* visible(rendered(page))
      yield* animationsSettled(page)
      yield* check(page)
      expect(yield* failures).toEqual([])
    }))

layer(Layer.merge(SiteLive, BrowserLive), { excludeTestServices: true, timeout: "2 minutes" })(
  "Theoria home forced colours in Chromium",
  (it) => {
    it.scoped("focus is outlined in Highlight on a disc, an answer's mark and the primary action", () =>
      inForcedColors((page) =>
        Effect.gen(function*() {
          const highlight = yield* system(page, "Highlight")
          const outlined = (control: Locator, what: string) =>
            Effect.gen(function*() {
              yield* eventually(() => control.evaluate((node) => node.matches(":focus-visible")), true)
              const { outline } = yield* edge(control)
              expect({ what, style: outline.style, colour: outline.color, drawn: outline.width > 0 })
                .toEqual({ what, style: "solid", colour: highlight, drawn: true })
            })
          // Focus moves as a keyboard reader's does — no pointer first, so `:focus-visible` holds.
          const action = page.getByRole("link", { name: "Browse the packages" })
          yield* focus(action)
          yield* outlined(action, "primary action")
          const disc = page.locator("[data-place-marker]").last()
          yield* focus(disc)
          yield* outlined(disc, "disc")
          // Enter opens the disc's answer; Tab reaches the first mark inside it.
          yield* press(page, "Enter")
          const answer = page.locator("[data-place-provenance]")
          yield* visible(answer)
          yield* press(page, "Tab")
          yield* outlined(answer.locator(":focus"), "answer's mark")
        })
      ))

    it.scoped("the merge switch tells checked from unchecked by track and thumb", () =>
      inForcedColors((page) =>
        Effect.gen(function*() {
          const track = mergeSwitch(page, false)
          const thumb = track.locator("[data-switch-thumb]")
          yield* act(() => track.scrollIntoViewIfNeeded())
          const canvasText = yield* system(page, "CanvasText")
          const highlight = yield* system(page, "Highlight")
          const highlightText = yield* system(page, "HighlightText")
          expect((yield* edge(track)).border.color).toBe(canvasText)
          const uncheckedTrack = yield* colour(track)
          expect(yield* colour(thumb)).toBe(canvasText)
          yield* click(track)
          const checked = mergeSwitch(page, true)
          yield* visible(checked)
          yield* eventually(() => checked.evaluate(backgroundColour), highlight)
          expect(uncheckedTrack).not.toBe(highlight)
          yield* eventually(() => checked.locator("[data-switch-thumb]").evaluate(backgroundColour), highlightText)
        })
      ))

    it.scoped("the Build tab indicator is a CanvasText line", () =>
      inForcedColors((page) =>
        Effect.gen(function*() {
          const indicator = page.locator("[data-place-act='build']").getByRole("tablist").locator(
            "[data-tab-indicator]"
          )
          expect(yield* colour(indicator)).toBe(yield* system(page, "CanvasText"))
          expect(yield* act(() => indicator.evaluate((node) => node.getBoundingClientRect().height)))
            .toBeGreaterThan(0)
        })
      ))

    it.scoped("the strand's current knot is filled and the earlier one open", () =>
      inForcedColors((page) =>
        Effect.gen(function*() {
          const merge = mergeSwitch(page, false)
          yield* act(() => merge.scrollIntoViewIfNeeded())
          yield* click(merge)
          yield* visible(page.locator("[data-place-version]").nth(1))
          const knots = page.locator("[data-place-version] > *:first-child > span:first-child")
          expect(yield* colour(knots.first())).toBe(yield* system(page, "Canvas"))
          expect(yield* colour(knots.last())).toBe(yield* system(page, "CanvasText"))
          const canvasText = yield* system(page, "CanvasText")
          Arr.forEach(yield* edges(knots), ({ border }) => {
            expect(border.width).toBeGreaterThan(0)
            expect(border.color).toBe(canvasText)
          })
        })
      ))

    it.scoped("every disc keeps a CanvasText edge on the Canvas", () =>
      inForcedColors((page) =>
        Effect.gen(function*() {
          const canvasText = yield* system(page, "CanvasText")
          const canvas = yield* system(page, "Canvas")
          const discs = page.locator("[data-place-marker]")
          const found = yield* edges(discs)
          expect(found.length).toBeGreaterThan(0)
          Arr.forEach(found, ({ border }) => {
            expect(border.width).toBeGreaterThan(0)
            expect(border.color).toBe(canvasText)
          })
          expect(yield* colour(discs.first())).toBe(canvas)
        })
      ))

    it.scoped("a line of code lights in Highlight under the pointer, and no line is lit without it", () =>
      inForcedColors((page) =>
        Effect.gen(function*() {
          const highlight = yield* system(page, "Highlight")
          const build = page.locator("[data-place-act='build']")
          const line = build.locator("[data-place-code-line]").first()
          yield* act(() => line.scrollIntoViewIfNeeded())
          // Before the pointer, nothing on the page wears the selection colour.
          expect(yield* colour(line)).not.toBe(highlight)
          expect(yield* colour(page.locator("[data-place-marker]").first())).not.toBe(highlight)
          yield* hover(line)
          const lit = build.locator("[data-code-line-focused]")
          yield* visible(lit)
          yield* eventually(() => lit.evaluate(backgroundColour), highlight)
          expect(yield* act(() => lit.evaluate(textColour))).toBe(yield* system(page, "HighlightText"))
        })
      ))

    it.scoped("a merged proposer's rule is solid and an unmerged one dashed, both in CanvasText", () =>
      inForcedColors((page) =>
        Effect.gen(function*() {
          const canvasText = yield* system(page, "CanvasText")
          const rules = yield* edges(page.locator("[data-place-proposal]"))
          expect(Arr.sort(Arr.map(rules, ({ border }) => border.style), Order.string)).toEqual(["dashed", "solid"])
          Arr.forEach(rules, ({ border }) => {
            expect(border.width).toBeGreaterThan(0)
            expect(border.color).toBe(canvasText)
          })
        })
      ))
  }
)
