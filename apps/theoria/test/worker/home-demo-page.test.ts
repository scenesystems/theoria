// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import { Effect, Fiber, Layer, Option } from "effect"
import * as Arr from "effect/Array"

import { stageMaxWidth } from "../../app/contracts/demo/imagined-place-flow.js"
import { type PlaceScenario, placeScenarioMeta, placeScenarios } from "../../app/contracts/imagined-place.js"
import { howItsBuiltActionLabel } from "../../app/web/view/home/HomeHero.js"
import { placeStepDefinitions } from "../../app/web/view/home/placeSteps.js"
import {
  act,
  animationsSettled,
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
  hidden,
  hover,
  nextResponse,
  openPage,
  overflowingElements,
  press,
  setColorScheme,
  setViewport,
  until,
  urlMatches,
  visible
} from "./browser.js"
import {
  activeElementOpensDocsLink,
  activeElementRole,
  canvasColour,
  currentLocation,
  documentTop,
  insideViewportRight,
  isActiveElement,
  markerLegendMetrics,
  paperProseContrast,
  scrollElementTo,
  scrollPast,
  scrollToTop,
  stageAndColumnWidths,
  storyDrawn,
  surfacePaint,
  textColour
} from "./platform/in-page.js"
import { SiteLive } from "./site.js"

import { colorSchemes, drawn, referenceTargets, searchSettlesWithin } from "./demo.js"

layer(Layer.merge(SiteLive, BrowserLive), { excludeTestServices: true, timeout: "3 minutes" })(
  "Theoria home page demo in Chromium: the page around the stage",
  (it) => {
    it.scoped("keyboard reaches every control", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* goto(page, "/")
        yield* drawn(page)
        const demo = page.getByRole("region", { name: "Imagined place demo" })
        const focusRole = () => page.evaluate(activeElementRole)

        // Scenarios are a radio group: arrows pick one, and picking rebuilds through the server.
        const scenarios = demo.getByRole("radiogroup", { name: "Scenario" })
        const checked = scenarios.getByRole("radio", { checked: true })
        yield* focus(checked)
        const rebuild = yield* Effect.fork(nextResponse(page, "POST", "/api/imagined-place/build"))
        yield* press(page, "ArrowRight")
        expect((yield* Fiber.join(rebuild)).status()).toBe(200)
        yield* eventually(focusRole, "radio")

        // Tab walks from the scenarios into the brief and on to the first merge switch, with nothing trapping it.
        const walkTo = (role: string) =>
          Effect.map(
            Effect.iterate(Arr.empty<string>(), {
              while: (trail) => !Arr.contains(trail, role) && trail.length < 12,
              body: (trail) =>
                Effect.gen(function*() {
                  yield* press(page, "Tab")
                  return Arr.append(trail, yield* act(focusRole))
                })
            }),
            (trail) => ({ reached: Arr.contains(trail, role), trail })
          )
        expect(yield* walkTo("textarea")).toMatchObject({ reached: true })
        expect(yield* walkTo("switch")).toMatchObject({ reached: true })
        const merge = demo.getByRole("switch").first()
        yield* eventually(() => merge.evaluate(isActiveElement), true)
        const before = yield* act(() => merge.getAttribute("aria-checked"))
        const remerge = yield* Effect.fork(nextResponse(page, "POST", "/api/imagined-place/build"))
        yield* press(page, "Space")
        expect((yield* Fiber.join(remerge)).status()).toBe(200)
        yield* attribute(merge, "aria-checked", before === "true" ? "false" : "true")

        // The code tabs rove with arrows and activate on Enter (the listings are heavy), and the listing follows.
        const section = page.locator("[data-place-how-its-built]")
        const activeTab = section.getByRole("tab", { selected: true })
        const firstStep = yield* act(() => activeTab.innerText())
        const listing = section.locator("[data-place-code-step]")
        const firstListing = yield* Option.fromNullable(yield* act(() => listing.getAttribute("data-place-code-step")))
        yield* focus(activeTab)
        yield* press(page, "ArrowRight")
        yield* eventually(focusRole, "tab")
        yield* press(page, "Enter")
        yield* until(act(() => activeTab.innerText()), (name) => name !== firstStep, "the next tab is selected")
        yield* count(listing, 1)
        yield* until(
          act(() => listing.getAttribute("data-place-code-step")),
          (step) => step !== firstListing,
          "the listing follows the selected tab"
        )

        // The trace slider answers arrows; its caption names the trial.
        const slider = demo.getByRole("slider", { name: "Trial drawn on the stage" })
        // The rebuild replays its trials first; the slider answers once the search is drawn.
        yield* eventually(() => slider.isEnabled(), true)
        yield* focus(slider)
        yield* press(page, "Home")
        yield* attribute(slider, "aria-valuenow", "0")
        yield* press(page, "ArrowRight")
        yield* attribute(slider, "aria-valuenow", "1")
        yield* containsText(demo.locator("[data-place-search-caption]"), /Trial 2 of|Kept trial/u)
        expect(yield* failures).toEqual([])
      }))

    it.scoped("nothing on the home page leaks past the viewport at any width", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 390, height: 844 } })
        yield* goto(page, "/")
        yield* drawn(page)
        // Shrinks to 320 first, then grows: the stage must follow the column both ways. Below `lg` the column
        // is the page's reading width and the stage takes it whole; at `lg` the column is the grid's second
        // track, narrower than the reading width just below `lg`, and the stage is recut to it.
        const stages = yield* Effect.forEach(Arr.make(320, 390, 820, 1280, 1680), (width) =>
          Effect.gen(function*() {
            yield* setViewport(page, { width, height: 900 })
            yield* drawn(page)
            yield* animationsSettled(page)
            expect(yield* overflowingElements(page)).toEqual([])
            expect(yield* fitsViewport(page)).toBe(true)
            // The stage is drawn for exactly the width inside the frame's border, and the frame fits the column.
            const widths = yield* until(
              act(() => page.evaluate(stageAndColumnWidths)),
              ({ column, drawable, frame, stage }) => stage > 0 && drawable === stage && frame <= column,
              `the stage and its frame fit the column at ${String(width)}px`
            )
            expect(widths.stage, `the stage takes its column at ${String(width)}px`).toBe(
              Math.min(stageMaxWidth, widths.column)
            )
            return widths.stage
          }))
        expect(Arr.lastNonEmpty(stages)).toBeGreaterThan(Arr.headNonEmpty(stages))
        expect(yield* failures).toEqual([])
      }))

    it.scoped("how it's built links every symbol to an existing reference anchor and shows values from the build", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* goto(page, "/")
        yield* drawn(page)

        const section = page.locator("[data-place-how-its-built]")
        yield* attribute(section.locator("[data-place-commit]"), "href", /github\.com\/scenesystems\/theoria\/tree\//u)

        const targets = yield* Effect.forEach(placeStepDefinitions, (step) =>
          Effect.gen(function*() {
            yield* click(section.getByRole("tab", { name: step.name }))
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

    it.scoped("a docs link previews its destination on a plain press and only the preview's own link leaves the page", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* setViewport(page, { width: 390, height: 844 })
        yield* goto(page, "/")
        yield* drawn(page)

        const section = page.locator("[data-place-how-its-built]")
        const reference = section.locator("[data-place-reference]").first()
        const href = yield* Option.fromNullable(yield* act(() => reference.getAttribute("href")))
        const preview = page.locator(`[data-docs-link-preview='${href}']`)

        yield* click(reference)
        yield* visible(preview)
        yield* urlMatches(page, /\/$/u)
        yield* containsText(preview, /v\d+\.\d+\.\d+/u)
        yield* containsText(preview, href.slice(1, href.indexOf("#")))
        yield* eventually(() => preview.evaluate(insideViewportRight), true)

        yield* press(page, "Escape")
        yield* hidden(preview)
        yield* eventually(() => reference.evaluate(isActiveElement), true)

        yield* press(page, "Enter")
        yield* visible(preview)
        yield* eventually(() => page.evaluate(activeElementOpensDocsLink), true)
        yield* press(page, "Enter")
        yield* eventually(() => page.evaluate(currentLocation), href)
        yield* attached(page.locator(`#${href.slice(href.indexOf("#") + 1)}`))
        expect(yield* failures).toEqual([])
      }))

    it.scoped("the acts answer on the stage", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* goto(page, "/")
        yield* drawn(page)
        const stage = page.locator("[data-place-stage-act]")
        yield* attribute(stage, "data-place-stage-act", "arrive")

        yield* act(() => page.locator("[data-place-act='propose']").evaluate(scrollElementTo, 0.45))
        yield* attribute(stage, "data-place-stage-act", "propose")
        yield* until(act(() => page.locator("[data-place-ghost]").count()), (ghosts) => ghosts >= 1, "a ghost disc")
        expect(yield* failures).toEqual([])
      }))

    it.scoped("the act follows a jump either way, and a return to the page", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* goto(page, "/")
        yield* drawn(page)
        const stage = page.locator("[data-place-stage-act]")
        yield* attribute(stage, "data-place-stage-act", "arrive")

        // A jump from the hero to the build lands past every act in between; no scroll crossed them.
        yield* click(page.getByRole("link", { exact: true, name: howItsBuiltActionLabel }))
        yield* attribute(stage, "data-place-stage-act", "build")
        // And back the other way, past them all again.
        yield* act(() => page.evaluate(scrollToTop))
        yield* attribute(stage, "data-place-stage-act", "arrive")

        // Leaving for the docs and coming back mounts the reading afresh, and it answers where it stands.
        yield* act(() => page.locator("[data-place-act='propose']").evaluate(scrollElementTo, 0.45))
        yield* attribute(stage, "data-place-stage-act", "propose")
        yield* click(page.getByRole("link", { exact: true, name: "Browse the packages" }))
        yield* visible(page.getByRole("heading", { level: 1, name: "Packages" }))
        yield* act(() => page.goBack())
        yield* drawn(page)
        yield* act(() => page.evaluate(scrollToTop))
        yield* attribute(stage, "data-place-stage-act", "arrive")
        yield* act(() => page.locator("[data-place-act='record']").evaluate(scrollElementTo, 0.45))
        yield* attribute(stage, "data-place-stage-act", "record")
        expect(yield* failures).toEqual([])
      }))

    it.scoped("choosing another story changes the drawing and nothing of the page, in every mode", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* goto(page, "/")
        yield* drawn(page)
        const demo = page.getByRole("region", { name: "Imagined place demo" })
        const scenarios = demo.getByRole("radiogroup", { name: "Scenario" })
        const brief = demo.getByRole("textbox", { name: "Brief" })
        const paper = page.locator("[data-place-stage='paper']")
        const title = page.locator("h1")
        // The story is taken once its own brief is in the field and the stage draws its features, kept.
        const storyTaken = (scenario: PlaceScenario) =>
          Effect.andThen(
            eventually(() => brief.inputValue(), placeScenarioMeta[scenario].brief),
            eventually(() => demo.evaluate(storyDrawn), true, searchSettlesWithin)
          )
        // The page's colours: the air behind it, the paper, and the ink of the title.
        const palette = Effect.all({
          air: act(() => page.evaluate(canvasColour)),
          paper: act(() => paper.evaluate(surfacePaint)),
          ink: act(() => title.evaluate(textColour))
        })

        yield* storyTaken("unfinished-light")
        const before = yield* palette
        yield* click(scenarios.getByRole("radio", { name: placeScenarioMeta["lost-market"].label }))
        yield* storyTaken("lost-market")
        expect(yield* palette).toEqual(before)

        yield* Effect.forEach(colorSchemes, (scheme) =>
          Effect.gen(function*() {
            yield* setColorScheme(page, scheme)
            yield* animationsSettled(page)
            const inScheme = yield* palette
            yield* Effect.forEach(placeScenarios, (scenario) =>
              Effect.gen(function*() {
                yield* click(scenarios.getByRole("radio", { name: placeScenarioMeta[scenario].label }))
                yield* storyTaken(scenario)
                expect(yield* palette).toEqual(inScheme)
                const contrast = yield* until(
                  act(() => page.evaluate(paperProseContrast)),
                  (ratio) => ratio >= 4.5,
                  `prose contrast in ${scenario} ${scheme}`
                )
                expect(contrast).toBeGreaterThanOrEqual(4.5)
              }))
          }))
        expect(yield* failures).toEqual([])
      }))

    it.scoped("the place stays as a band while the stage is scrolled past, and moves nothing", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 390, height: 844 } })
        yield* goto(page, "/")
        yield* drawn(page)
        const demo = page.getByRole("region", { name: "Imagined place demo" })
        const band = page.locator("[data-place-band]")
        const column = demo.locator("[data-place-stage='column']")
        const compose = demo.locator("[data-place-act='compose']")
        yield* hidden(band)

        const composeTop = yield* act(() => compose.evaluate(documentTop))
        yield* act(() => column.evaluate(scrollPast))
        yield* visible(band)
        const markers = yield* act(() => demo.locator("[data-place-marker]").count())
        yield* count(band.locator("[data-place-band-disc]"), markers)
        expect(yield* act(() => compose.evaluate(documentTop))).toBe(composeTop)

        yield* act(() => page.evaluate(scrollToTop))
        yield* hidden(band)

        // At the reading width the stage is pinned beside the acts; only the Build act scrolls it away.
        yield* setViewport(page, { width: 1280, height: 800 })
        yield* act(() => demo.locator("[data-place-act='propose']").evaluate(scrollElementTo, 0.45))
        yield* hidden(band)
        const build = demo.locator("[data-place-act='build']")
        yield* act(() => build.evaluate(scrollElementTo, 0))
        yield* visible(band)
        const composeLine = build.locator("[data-place-code-step='compose'] [data-code-annotation]").first()
        yield* hover(composeLine)
        yield* count(band.locator("[data-place-band-disc][data-place-focused]"), 4)
        expect(yield* failures).toEqual([])
      }))

    it.scoped("stage prose metrics stay aligned with geometry across responsive widths", () =>
      Effect.gen(function*() {
        const viewports = [
          { width: 390, height: 844 },
          { width: 768, height: 1024 },
          { width: 1280, height: 800 }
        ]
        const { failures, page } = yield* openPage({ viewport: { width: 390, height: 844 } })
        yield* goto(page, "/")

        yield* Effect.forEach(viewports, (viewport) =>
          Effect.gen(function*() {
            yield* setViewport(page, viewport)
            yield* goto(page, "/")
            const lines = page.locator("[data-place-line]").first()
            yield* visible(lines)
            const stage = yield* act(() =>
              page.locator("[data-place-line]").evaluateAll((elements) =>
                elements.slice(0, 3).map((element) => {
                  const span = element.querySelector("span")
                  const computed = (span ?? element).computedStyleMap()
                  return {
                    fontSize: computed.get("font-size")?.toString(),
                    lineHeight: computed.get("line-height")?.toString(),
                    height: element.getBoundingClientRect().height,
                    clipped: (span?.scrollWidth ?? 0) > element.clientWidth + 1
                  }
                })
              )
            )
            Arr.forEach(stage, (metrics) => {
              expect(metrics.fontSize).toBe("16px")
              expect(metrics.lineHeight).toBe("26px")
              expect(metrics.height).toBe(26)
              expect(metrics.clipped).toBe(false)
            })

            yield* goto(page, "/docs")
            const card = page.locator("[class*=\"--st-fs-card-summary\"]").first()
            yield* visible(card)
            const cardMetrics = yield* act(() =>
              card.evaluate((element) => {
                const computed = element.computedStyleMap()
                return {
                  fontSize: computed.get("font-size")?.toString(),
                  lineHeight: computed.get("line-height")?.toString()
                }
              })
            )
            expect(cardMetrics).toEqual(
              viewport.width === 390
                ? { fontSize: "15px", lineHeight: "22px" }
                : { fontSize: "16px", lineHeight: "26px" }
            )
          }))
        expect(yield* failures).toEqual([])
      }))

    it.scoped("the mobile numbered legend names every disc in no more than two lines", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 390, height: 844 } })
        yield* goto(page, "/")
        yield* drawn(page)
        const legend = page.locator("[data-place-legend]")
        yield* visible(legend)
        const metrics = yield* act(() => legend.evaluate(markerLegendMetrics))
        expect(metrics.entries).toHaveLength(metrics.markerLabels.length)
        Arr.forEach(metrics.entries, (entry, index) => {
          expect(entry).not.toContain("added by")
          expect(metrics.markerLabels[index]).toContain(metrics.names[index])
        })
        expect(metrics.markerLabels.some((label) => label.includes("added by neighbor"))).toBe(true)
        expect(metrics.height).toBeLessThanOrEqual(2 * metrics.lineHeight + metrics.rowGap)
        expect(yield* failures).toEqual([])
      }))
  }
)
