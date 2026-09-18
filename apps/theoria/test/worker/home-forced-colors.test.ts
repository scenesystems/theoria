// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import type { Locator, Page } from "@playwright/test"
import { Boolean as Bool, Effect, Layer, Number as Num, Option, Order, String as Str } from "effect"
import * as Arr from "effect/Array"
import { evaluate, evaluateElement, evaluateElements } from "./browser.js"

import type { ColorScheme } from "./browser.js"
import {
  act,
  animationsSettled,
  attribute,
  BrowserLive,
  click,
  eventually,
  focus,
  goto,
  openPage,
  press,
  visible
} from "./browser.js"
import { drawn } from "./demo.js"
import {
  backgroundColour,
  boxHeight,
  edgesOf,
  focusVisible,
  outlineColour,
  scrollElementTo,
  systemColour,
  textColour
} from "./platform/in-page.js"
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
const colour = (locator: Locator) => evaluateElement(locator, backgroundColour)
const system = (page: Page, name: string) => evaluate(page, systemColour, name)
const edges = (locator: Locator) => evaluateElements(locator, edgesOf)
const edge = (locator: Locator) =>
  Effect.map(
    edges(locator),
    (found) => Option.getOrElse(Arr.get(found, 0), () => ({ outline: absent, border: absent }))
  )
const absent = { color: "", style: "none", width: 0 }
// The program's proposal is the one unmerged at first sight; scoping by its
// proposer keeps the locator stable through the merge.
const mergeSwitch = (page: Page, checked: boolean) =>
  page.locator("[data-place-proposal='program']").getByRole("switch", { checked })

const inForcedColors = <R>(check: (page: Page) => Effect.Effect<void, unknown, R>) =>
  Effect.forEach(colorSchemes, (scheme) =>
    Effect.gen(function*() {
      const { failures, page } = yield* openPage({ colorScheme: scheme, forcedColors: "active" })
      yield* goto(page, "/")
      yield* drawn(page)
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
          // The colour is waited for: a disc transitions its outline colour, and the forced palette
          // is what it transitions between.
          const inHighlight = (control: Locator, what: string, expectedFocusVisible: boolean) =>
            Effect.gen(function*() {
              yield* eventually(evaluateElement(control, focusVisible), expectedFocusVisible)
              yield* eventually(evaluateElement(control, outlineColour), highlight)
              const { outline } = yield* edge(control)
              expect({ what, style: outline.style, drawn: Num.greaterThan(outline.width, 0) })
                .toEqual({ what, style: "solid", drawn: true })
            })
          const outlined = (control: Locator, what: string) => inHighlight(control, what, true)
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
          // The disc no longer holds focus, yet it is the one answering: the ring that says so is a
          // shadow, dropped here, so the disc's own outline says it in Highlight instead.
          const stated = (control: Locator, what: string) => inHighlight(control, what, false)
          yield* stated(disc, "open disc")
          // A merged proposal's name, pressed, answers for its disc: that disc says so the same way.
          yield* press(page, "Escape")
          const name = page.locator("[data-place-proposal][data-place-recorded='true']").first()
            .locator("[data-place-feature]")
          yield* act(() => name.scrollIntoViewIfNeeded())
          yield* click(name)
          yield* visible(answer)
          const answered = page.locator("[data-place-marker][data-place-focused]")
          yield* visible(answered)
          yield* stated(answered, "answered disc")
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
          yield* eventually(evaluateElement(checked, backgroundColour), highlight)
          expect(uncheckedTrack).not.toBe(highlight)
          yield* eventually(evaluateElement(checked.locator("[data-switch-thumb]"), backgroundColour), highlightText)
        })
      ))

    it.scoped("the Build tab indicator is a CanvasText line", () =>
      inForcedColors((page) =>
        Effect.gen(function*() {
          const indicator = page.locator("[data-place-act='build']").getByRole("tablist").locator(
            "[data-tab-indicator]"
          )
          expect(yield* colour(indicator)).toBe(yield* system(page, "CanvasText"))
          expect(yield* evaluateElement(indicator, boxHeight))
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

    it.scoped("an act lights a disc's outline in CanvasText, and a disc it says nothing of wears none", () =>
      inForcedColors((page) =>
        Effect.gen(function*() {
          const canvasText = yield* system(page, "CanvasText")
          const discs = page.locator("[data-place-marker]")
          const stage = page.locator("[data-place-stage-act]")
          yield* attribute(stage, "data-place-stage-act", "arrive")
          // The arrival says nothing of any disc. The silent outline is transparent, which the forced
          // palette would repaint in CanvasText and so light every disc; it is drawn as no outline instead.
          const silent = yield* edges(discs)
          expect(silent.length).toBeGreaterThan(0)
          Arr.forEach(silent, ({ outline }) => expect(outline.style).toBe("none"))
          // Composing lights the features the author drew first; the merged proposals' stay silent.
          yield* evaluateElement(page.locator("[data-place-act='compose']"), scrollElementTo, 0.45)
          yield* attribute(stage, "data-place-stage-act", "compose")
          const composed = yield* edges(discs)
          const [quiet, lit] = Arr.partition(
            composed,
            ({ outline }) => Bool.not(Str.Equivalence(outline.style, "none"))
          )
          expect(lit.length).toBeGreaterThan(0)
          expect(quiet.length).toBeGreaterThan(0)
          Arr.forEach(lit, ({ outline }) => {
            expect(outline.width).toBeGreaterThan(0)
            expect(outline.color).toBe(canvasText)
          })
        })
      ))

    it.scoped("a line of code lights in Highlight when pressed, and no line is lit without it", () =>
      inForcedColors((page) =>
        Effect.gen(function*() {
          const highlight = yield* system(page, "Highlight")
          const build = page.locator("[data-place-act='build']")
          const line = build.locator("[data-place-code-line]").first()
          yield* act(() => line.scrollIntoViewIfNeeded())
          // Before the press, nothing on the page wears the selection colour.
          expect(yield* colour(line)).not.toBe(highlight)
          expect(yield* colour(page.locator("[data-place-marker]").first())).not.toBe(highlight)
          yield* click(line)
          const lit = build.locator("[data-code-line-focused]")
          yield* visible(lit)
          yield* eventually(evaluateElement(lit, backgroundColour), highlight)
          expect(yield* evaluateElement(lit, textColour)).toBe(yield* system(page, "HighlightText"))
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

    it.scoped("inline mark labels inherit HighlightText from their pressed button", () =>
      inForcedColors((page) =>
        Effect.gen(function*() {
          const highlightText = yield* system(page, "HighlightText")
          yield* Effect.forEach([
            page.locator("[data-place-features] button").first(),
            page.locator("[data-place-proposal] dt button").first()
          ], (mark) =>
            Effect.gen(function*() {
              yield* click(mark)
              yield* visible(page.locator("[data-place-provenance]"))
              yield* eventually(evaluateElement(mark, textColour), highlightText)
              yield* eventually(evaluateElement(mark.locator("span").first(), textColour), highlightText)
              yield* press(page, "Escape")
            }))
        })
      ))
  }
)
