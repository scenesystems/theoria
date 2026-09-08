// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import type { Locator, Page } from "@playwright/test"
import { Effect, Fiber, Layer, Option } from "effect"
import * as Arr from "effect/Array"

import { imaginedPlaceSectionId } from "../../app/web/view/home/HomeHero.js"
import { placeStepDefinitions } from "../../app/web/view/home/placeSteps.js"
import {
  accessibilityTree,
  act,
  attribute,
  BrowserLive,
  click,
  count,
  fill,
  goto,
  hover,
  nextResponse,
  openPage,
  until,
  visible,
  withoutAttribute
} from "./browser.js"
import {
  backgroundColour,
  bandDiscNames,
  beforeRuleCentreX,
  scrollPast,
  topmostAt,
  topmostAtItsCentre
} from "./platform/in-page.js"
import { SiteLive } from "./site.js"

/**
 * The demonstration's form, measured in the browser: where things stand and
 * what stands over what. Each claim here is one the eye makes at a glance —
 * a dot on its line, a name level with its packages, one wash for what is
 * lit — and each was once wrong on the page.
 */

const rendered = (page: Page) => page.locator("[data-place-render-phase='complete']")

/** An element's box on the viewport; an element with no box fails the test. */
const boxOf = (locator: Locator) =>
  Effect.flatMap(act(() => locator.boundingBox()), (box) =>
    Option.match(Option.fromNullable(box), {
      onNone: () => Effect.dieMessage("the element has no box"),
      onSome: (some) => Effect.succeed({ ...some, centreX: some.x + some.width / 2, centreY: some.y + some.height / 2 })
    }))

layer(Layer.merge(SiteLive, BrowserLive), { excludeTestServices: true, timeout: "3 minutes" })(
  "Theoria home page form in Chromium",
  (it) => {
    it.scoped("the spine's dots stand centred on its line, and over it", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* goto(page, "/")
        yield* visible(rendered(page))
        const demo = page.getByRole("region", { name: "Imagined place demo" })
        const acts = demo.locator("[data-place-acts]")
        const dots = demo.locator("[data-place-spine-dot]")
        yield* count(dots, 3)
        yield* Effect.forEach(Arr.range(0, 2), (index) =>
          Effect.gen(function*() {
            const dot = dots.nth(index)
            // In the viewport, so what is topmost at the dot can be asked; the line is measured from the same scroll.
            yield* act(() => dot.scrollIntoViewIfNeeded())
            const lineX = yield* act(() => acts.evaluate(beforeRuleCentreX))
            const box = yield* boxOf(dot)
            // On the line's centre, to within half a pixel; and the dot paints over the line, so an open ring is open.
            expect(Math.abs(box.centreX - lineX)).toBeLessThanOrEqual(0.5)
            expect(yield* act(() => dot.evaluate(topmostAt, { x: lineX, y: box.centreY }))).toBe(true)
          }))
        expect(yield* failures).toEqual([])
      }))

    it.scoped("a step's name and the packages that do its work stand level", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* goto(page, "/")
        yield* visible(rendered(page))
        const demo = page.getByRole("region", { name: "Imagined place demo" })
        yield* Effect.forEach(placeStepDefinitions, (step) =>
          Effect.gen(function*() {
            const header = demo.locator(`[data-place-step='${step.id}'] [data-place-step-header]`)
            const name = yield* boxOf(header.getByRole("button", { exact: true, name: step.name }))
            const packages = header.locator("a")
            const total = yield* act(() => packages.count())
            expect(total).toBe(step.packages.length)
            yield* Effect.forEach(Arr.range(0, total - 1), (index) =>
              Effect.map(boxOf(packages.nth(index)), (box) => {
                expect(Math.abs(box.centreY - name.centreY)).toBeLessThanOrEqual(1)
              }))
          }))
        expect(yield* failures).toEqual([])
      }))

    it.scoped("what is lit wears one wash wherever it stands", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* goto(page, "/")
        yield* visible(rendered(page))
        const demo = page.getByRole("region", { name: "Imagined place demo" })
        const overlay = page.locator("[data-place-provenance]")
        const built = page.locator("[data-place-how-its-built]")
        const propose = yield* Arr.findFirst(placeStepDefinitions, (step) => step.id === "propose")
        yield* click(built.getByRole("tab", { name: propose.name }))

        // A merged proposal's name, pointed at, lights its line of the prose, the line of code that
        // digested it, that line's number, and the value beside it: one wash on all of them.
        const merged = demo.locator("[data-place-proposal][data-place-recorded='true']").first()
        const name = merged.locator("[data-place-feature]")
        yield* act(() => name.scrollIntoViewIfNeeded())
        yield* hover(name)
        yield* visible(overlay)
        const lit = [
          name,
          demo.locator("[data-place-line][data-place-focused]"),
          page.locator("[data-code-line-focused]"),
          page.locator("[data-place-code-line][data-place-focused]"),
          page.locator("[data-provenance][data-place-focused] [data-code-annotation]")
        ]
        yield* Effect.forEach(lit, (element) => count(element, 1))
        const washes = yield* until(
          Effect.forEach(lit, (element) => act(() => element.evaluate(backgroundColour))),
          (colours) => Arr.dedupe(colours).length === 1,
          "one wash on everything lit"
        )
        expect(Arr.dedupe(washes)).toHaveLength(1)
        expect(washes[0]).not.toBe("rgba(0, 0, 0, 0)")
        expect(yield* failures).toEqual([])
      }))

    it.scoped("a preview opened from an answer stands over the answer", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* goto(page, "/")
        yield* visible(rendered(page))
        const demo = page.getByRole("region", { name: "Imagined place demo" })
        const overlay = page.locator("[data-place-provenance]")
        const feature = demo.locator("[data-place-features] [data-provenance]").first()
        yield* act(() => feature.scrollIntoViewIfNeeded())
        yield* hover(feature)
        yield* visible(overlay)
        yield* click(overlay.locator("a[href^='/docs/']").first())
        const preview = page.locator("[data-docs-link-preview]")
        yield* visible(preview)
        expect(yield* act(() => preview.evaluate(topmostAtItsCentre))).toBe(true)
        expect(yield* failures).toEqual([])
      }))

    it.scoped("the band is a strip, no taller than a line of text, with a way back up", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 390, height: 844 } })
        yield* goto(page, "/")
        yield* visible(rendered(page))
        const demo = page.getByRole("region", { name: "Imagined place demo" })
        const band = page.locator("[data-place-band]")
        yield* act(() => demo.locator("[data-place-stage='column']").evaluate(scrollPast))
        yield* visible(band)
        const strip = band.getByRole("link", { name: "Back to the place" })
        const box = yield* boxOf(strip)
        expect(box.height).toBeLessThanOrEqual(40)
        expect(box.width).toBeLessThanOrEqual(390 * 0.8)
        yield* visible(band.locator("[data-place-band-icon]"))
        yield* count(
          band.locator("[data-place-band-disc]"),
          yield* act(() => demo.locator("[data-place-marker]").count())
        )
        expect(yield* failures).toEqual([])
      }))

    it.scoped("to assistive technology the band is one link, named for where it goes and what it shows", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 390, height: 844 } })
        yield* goto(page, "/")
        yield* visible(rendered(page))
        const demo = page.getByRole("region", { name: "Imagined place demo" })
        const band = page.locator("[data-place-band]")
        yield* act(() => demo.locator("[data-place-stage='column']").evaluate(scrollPast))
        yield* visible(band)
        const names = yield* act(() => band.evaluate(bandDiscNames))
        expect(names.length).toBeGreaterThan(1)
        // The row and the arrow are decoration; the tree holds the link alone, and its name lists the row.
        const nodes = Arr.filter((yield* accessibilityTree(band)).split("\n"), (line) => !line.startsWith(" "))
        expect(nodes).toHaveLength(1)
        expect(nodes[0]).toMatch(/^- '?link "Back to the place: /u)
        const named = (drawn: ReadonlyArray<string>) =>
          band.getByRole("link", { exact: true, name: `Back to the place: ${Arr.join(drawn, ", ")}` })
        yield* count(named(names), 1)
        yield* attribute(named(names), "href", `#${imaginedPlaceSectionId}`)
        yield* count(band.getByRole("img"), 0)
        // A merge adds a disc to the row, and its name to the link.
        yield* click(demo.getByRole("switch", { checked: false }).first())
        const after = yield* until(
          act(() => band.evaluate(bandDiscNames)),
          (drawn) => drawn.length === names.length + 1,
          "one more disc in the band"
        )
        yield* count(named(after), 1)
        expect(yield* failures).toEqual([])
      }))

    it.scoped("the arrival leads the demonstration, and Compose and Arrange start on one line", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* goto(page, "/")
        yield* visible(rendered(page))
        const demo = page.getByRole("region", { name: "Imagined place demo" })
        const arrive = yield* boxOf(demo.locator("[data-place-arrive]"))
        const compose = yield* boxOf(demo.locator("[data-place-step='compose']"))
        const arrange = yield* boxOf(demo.locator("[data-place-step='arrange']"))
        expect(arrive.y + arrive.height).toBeLessThanOrEqual(compose.y)
        expect(arrive.y + arrive.height).toBeLessThanOrEqual(arrange.y)
        expect(Math.abs(compose.y - arrange.y)).toBeLessThanOrEqual(1)
        expect(yield* failures).toEqual([])
      }))

    it.scoped("the Build act is titled and not narrated: no paragraph stands between its title and the code", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* goto(page, "/")
        yield* visible(rendered(page))
        const built = page.locator("[data-place-how-its-built]")
        yield* visible(built.getByRole("heading", { level: 3, name: "How it's built" }))
        yield* count(built.locator("h3 ~ p"), 0)
        expect(yield* failures).toEqual([])
      }))

    it.scoped("the Compose act reads down: the stories, the title, the brief, the features", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* goto(page, "/")
        yield* visible(rendered(page))
        const compose = page.locator("[data-place-step='compose']")
        const stories = yield* boxOf(compose.getByRole("radiogroup", { name: "Scenario" }))
        const title = yield* boxOf(compose.locator("[data-place-composition-title]"))
        const brief = yield* boxOf(compose.getByRole("textbox"))
        const features = yield* boxOf(compose.locator("[data-place-features]"))
        expect(stories.y + stories.height).toBeLessThanOrEqual(title.y)
        expect(title.y + title.height).toBeLessThanOrEqual(brief.y)
        expect(brief.y + brief.height).toBeLessThanOrEqual(features.y)
        // The features are named as what they are, beside the status of the inference that named them.
        yield* visible(compose.locator("[data-place-features-label]"))
        // An edited brief shows as the field's own dirty state and in the version it builds, not in a sentence:
        // the act has no more paragraphs after the edit than before it.
        const field = compose.getByRole("textbox")
        const paragraphs = yield* act(() => compose.locator("p").count())
        yield* withoutAttribute(field, "data-dirty")
        const rebuild = yield* Effect.fork(nextResponse(page, "POST", "/api/imagined-place/build"))
        yield* fill(field, "a lighthouse keeper's rock, reached at low water")
        expect((yield* Fiber.join(rebuild)).status()).toBe(200)
        yield* attribute(field, "data-dirty", "")
        yield* count(compose.locator("p"), paragraphs)
        expect(yield* failures).toEqual([])
      }))
  }
)
