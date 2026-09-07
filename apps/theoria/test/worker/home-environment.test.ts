// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import type { Page } from "@playwright/test"
import { Chunk, Effect, Layer, Match, Schedule, Stream } from "effect"
import * as Arr from "effect/Array"

import { type PlaceScenario, placeScenarioMeta, placeScenarios } from "../../app/contracts/imagined-place.js"
import type { ColorScheme, Viewport } from "./browser.js"
import {
  act,
  animationsSettled,
  BrowserLive,
  click,
  eventually,
  fitsViewport,
  focus,
  goto,
  hover,
  openPage,
  overflowingElements,
  press,
  setColorScheme,
  until,
  visible
} from "./browser.js"
import {
  animatedProperties,
  paperProseContrast,
  recordedPaperFrames,
  recordPaperFrames,
  retainedRects,
  scrollElementTo,
  scrollToTop,
  storyDrawn,
  textContrastOf,
  topEdgeInViewport,
  viewportTop
} from "./platform/in-page.js"
import { SiteLive } from "./site.js"

const viewports: ReadonlyArray<Viewport> = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 }
]
const colorSchemes: ReadonlyArray<ColorScheme> = ["light", "dark"]
const rendered = (page: Page) => page.locator("[data-place-render-phase='complete']")
const leadHeaders = (page: Page, width: number) =>
  Match.value(width >= 1024).pipe(
    Match.when(true, (): ReadonlyArray<"compose" | "arrange"> => ["compose", "arrange"]),
    Match.when(false, (): ReadonlyArray<"compose" | "arrange"> => ["arrange"]),
    Match.exhaustive,
    Arr.map((step) => page.locator(`[data-place-step='${step}'] [data-place-step-header]`))
  )
const storyTaken = (page: Page, scenario: PlaceScenario) =>
  Effect.andThen(
    eventually(() => page.getByRole("textbox", { name: "Brief" }).inputValue(), placeScenarioMeta[scenario].brief),
    eventually(() => page.getByRole("region", { name: "Imagined place demo" }).evaluate(storyDrawn), true)
  )

layer(Layer.merge(SiteLive, BrowserLive), { excludeTestServices: true, timeout: "2 minutes" })(
  "Theoria home environment in Chromium",
  (it) => {
    Arr.forEach(
      viewports,
      (viewport) =>
        it.scoped(`at ${String(viewport.width)}×${String(viewport.height)} every story fits and its lead is visible`, () =>
          Effect.gen(function*() {
            const { failures, page } = yield* openPage({ viewport })
            yield* goto(page, "/")
            yield* visible(rendered(page))
            const scenarios = page.getByRole("radiogroup", { name: "Scenario" })
            yield* Effect.forEach(colorSchemes, (scheme) =>
              Effect.gen(function*() {
                yield* setColorScheme(page, scheme)
                yield* animationsSettled(page)
                yield* act(() => page.evaluate(scrollToTop))
                const arrival = page.locator("[data-place-arrive] h2")
                expect(yield* act(() => arrival.evaluate(topEdgeInViewport))).toBe(true)
                yield* Effect.forEach(viewport.width >= 1024 ? leadHeaders(page, viewport.width) : [], (header) =>
                  Effect.map(
                    act(() =>
                      header.evaluate(topEdgeInViewport)
                    ),
                    (inside) => expect(inside).toBe(true)
                  ))
                const edges = yield* Effect.all({
                  arrival: act(() => arrival.evaluate(viewportTop)),
                  headers: Effect.forEach(
                    leadHeaders(page, viewport.width),
                    (header) => act(() => header.evaluate(viewportTop))
                  )
                })
                expect(edges.arrival, `${scheme} arrival edge`).toBeGreaterThanOrEqual(0)
                yield* Effect.forEach(placeScenarios, (scenario) =>
                  Effect.gen(function*() {
                    yield* click(scenarios.getByRole("radio", { name: placeScenarioMeta[scenario].label }))
                    yield* storyTaken(page, scenario)
                    expect(yield* fitsViewport(page)).toBe(true)
                    expect(yield* overflowingElements(page)).toEqual([])
                  }))
              }))
            expect(yield* failures).toEqual([])
          }))
    )

    it.scoped("under reduced motion searches have frames while merges and story changes move only by opacity", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" })
        yield* act(() => page.addInitScript(recordPaperFrames))
        yield* goto(page, "/")
        yield* visible(rendered(page))
        const allowed = [
          "opacity",
          "color",
          "background-color",
          "border-color",
          "border-bottom-color",
          "border-left-color",
          "border-right-color",
          "border-top-color",
          "fill",
          "stroke"
        ]
        const sampleChange = (change: Effect.Effect<void, unknown>) =>
          Effect.gen(function*() {
            const before = yield* act(() => page.evaluate(retainedRects))
            yield* change
            const samples = yield* Stream.repeatEffectWithSchedule(
              Effect.all({
                properties: act(() => page.evaluate(animatedProperties)),
                rects: act(() => page.evaluate(retainedRects))
              }),
              Schedule.spaced("16 millis").pipe(Schedule.upTo("2 seconds"))
            ).pipe(Stream.runCollect, Effect.map(Chunk.toReadonlyArray))
            yield* visible(rendered(page))
            yield* animationsSettled(page)
            const after = yield* act(() => page.evaluate(retainedRects))
            const properties = Arr.dedupe(Arr.flatMap(samples, (sample) => sample.properties))
            expect(Arr.difference(properties, allowed)).toEqual([])
            expect(
              Arr.difference(Arr.dedupe(Arr.map(samples, (sample) => sample.rects.join("|"))), [
                before.join("|"),
                after.join("|")
              ])
            ).toEqual([])
            return properties
          })
        const merge = page.getByRole("switch", { checked: false, name: /^Merge Ship's bell/u })
        yield* act(() => merge.scrollIntoViewIfNeeded())
        yield* sampleChange(click(merge))
        const story = page.getByRole("radiogroup", { name: "Scenario" }).getByRole("radio").nth(1)
        yield* act(() => story.scrollIntoViewIfNeeded())
        yield* sampleChange(click(story))
        const trials = Arr.dedupe(
          (yield* act(() => page.evaluate(recordedPaperFrames))).split("\n").filter((frame) =>
            frame.includes("running")
          )
        )
        expect(trials.length).toBeGreaterThanOrEqual(2)
        expect(yield* failures).toEqual([])
      }))

    it.scoped("light and dark keep every interactive state at readable contrast", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 1280, height: 800 } })
        yield* goto(page, "/")
        yield* visible(rendered(page))
        yield* Effect.forEach(colorSchemes, (scheme) =>
          Effect.gen(function*() {
            yield* setColorScheme(page, scheme)
            yield* goto(page, "/")
            yield* visible(rendered(page))
            const marker = page.locator("[data-place-marker]").last()
            yield* focus(marker)
            yield* press(page, "Enter")
            const answer = page.locator("[data-place-provenance] [data-current]")
            yield* visible(answer)
            expect(yield* act(() => answer.evaluate(textContrastOf))).toBeGreaterThanOrEqual(4.5)
            yield* press(page, "Escape")
            const build = page.locator("[data-place-act='build']")
            yield* act(() => build.evaluate(scrollElementTo, 0))
            const bandLink = page.locator("[data-place-band] a")
            yield* visible(bandLink)
            expect(yield* act(() => bandLink.evaluate(textContrastOf))).toBeGreaterThanOrEqual(4.5)
            const line = build.locator("[data-place-code-line]").first()
            yield* hover(line)
            yield* visible(build.locator("[data-code-line-focused]"))
            expect(yield* act(() => build.locator("code.block").nth(1).evaluate(textContrastOf)))
              .toBeGreaterThanOrEqual(4.5)
            const radio = page.getByRole("radiogroup", { name: "Scenario" }).getByRole("radio").nth(
              scheme === "light" ? 1 : 2
            )
            yield* click(radio)
            const caption = page.locator("[data-place-search-caption]")
            const running = yield* until(act(() => caption.innerText()), (text) => text.length > 0, "search caption")
            expect(running.length).toBeGreaterThan(0)
            expect(yield* act(() => caption.evaluate(textContrastOf))).toBeGreaterThanOrEqual(4.5)
            yield* storyTaken(page, scheme === "light" ? "lost-market" : "drowned-library")
            expect(yield* act(() => page.evaluate(paperProseContrast))).toBeGreaterThanOrEqual(4.5)
          }))
        expect(yield* failures).toEqual([])
      }))
  }
)
