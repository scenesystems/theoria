// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import type { Locator, Page } from "@playwright/test"
import { Chunk, Effect, Layer, Match, Option, Schedule, Schema, Stream } from "effect"
import * as Arr from "effect/Array"
import * as Record from "effect/Record"

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
  fullyInViewport,
  lowestTextContrastWithin,
  motionSample,
  paperProseContrast,
  recordedPaperFrames,
  recordPaperFrames,
  scrollElementTo,
  scrollToTop,
  storyDrawn,
  topEdgeInViewport
} from "./platform/in-page.js"
import { SiteLive } from "./site.js"

/** The device-typical viewport at each width the plan names. */
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

/**
 * What leads the first viewport. A short phone screen belongs to the hero:
 * its title, lead and both actions are wholly in view, and "See how it's
 * built" points down. Where there is room the arrival's title is in view too;
 * at `lg` both column headers stand beside it, and below `lg` the columns
 * stack with Arrange first, above the paper, so that header leads.
 */
const FirstViewportLead = Schema.Literal("hero", "arrival-and-first-header", "arrival-and-both-headers")
type FirstViewportLead = typeof FirstViewportLead.Type

const shortViewport = 640
const twoColumns = 1024

const firstViewportLead = (viewport: Viewport): FirstViewportLead =>
  viewport.height < shortViewport
    ? "hero"
    : viewport.width >= twoColumns
    ? "arrival-and-both-headers"
    : "arrival-and-first-header"

const stepHeader = (page: Page, step: "compose" | "arrange") =>
  page.locator(`[data-place-step='${step}'] [data-place-step-header]`)

const leadsFirstViewport = (page: Page, viewport: Viewport) =>
  Match.value(firstViewportLead(viewport)).pipe(
    Match.when("hero", () =>
      Effect.forEach(
        [
          page.locator("h1"),
          page.locator("[data-home-hero] p").first(),
          ...[0, 1].map((index) => page.locator("[data-home-hero] a").nth(index))
        ],
        (part) => Effect.map(act(() => part.evaluate(fullyInViewport)), (inside) => expect(inside).toBe(true))
      )),
    Match.when("arrival-and-first-header", () =>
      Effect.gen(function*() {
        expect(yield* act(() => page.locator("[data-place-arrive] h2").evaluate(topEdgeInViewport))).toBe(true)
        const tops = yield* Effect.all({
          arrange: act(() => stepHeader(page, "arrange").evaluate((node) => node.getBoundingClientRect().top)),
          compose: act(() => stepHeader(page, "compose").evaluate((node) => node.getBoundingClientRect().top))
        })
        expect(tops.arrange).toBeLessThan(tops.compose)
        expect(yield* act(() => stepHeader(page, "arrange").evaluate(topEdgeInViewport))).toBe(true)
      })),
    Match.when("arrival-and-both-headers", () =>
      Effect.forEach(
        [page.locator("[data-place-arrive] h2"), stepHeader(page, "compose"), stepHeader(page, "arrange")],
        (part) => Effect.map(act(() => part.evaluate(topEdgeInViewport)), (inside) => expect(inside).toBe(true))
      )),
    Match.exhaustive
  )

const storyTaken = (page: Page, scenario: PlaceScenario) =>
  Effect.andThen(
    eventually(() => page.getByRole("textbox", { name: "Brief" }).inputValue(), placeScenarioMeta[scenario].brief),
    eventually(() => page.getByRole("region", { name: "Imagined place demo" }).evaluate(storyDrawn), true)
  )

const readable = (locator: Locator) =>
  Effect.map(act(() => locator.evaluate(lowestTextContrastWithin)), (lowest) => {
    expect(lowest.ratio, lowest.text).toBeGreaterThanOrEqual(4.5)
    return lowest.ratio
  })

/** What an honest reduced-motion change may still animate: colour and opacity, never geometry. */
const opacityAndColour = [
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

layer(Layer.merge(SiteLive, BrowserLive), { excludeTestServices: true, timeout: "2 minutes" })(
  "Theoria home environment in Chromium",
  (it) => {
    Arr.forEach(viewports, (viewport) =>
      it.scoped(
        `at ${String(viewport.width)}×${String(viewport.height)} every story fits in light and dark, and ${
          firstViewportLead(viewport)
        } leads the first viewport`,
        () =>
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
                yield* leadsFirstViewport(page, viewport)
                yield* Effect.forEach(placeScenarios, (scenario) =>
                  Effect.gen(function*() {
                    yield* click(scenarios.getByRole("radio", { name: placeScenarioMeta[scenario].label }))
                    yield* storyTaken(page, scenario)
                    expect(yield* fitsViewport(page)).toBe(true)
                    expect(yield* overflowingElements(page)).toEqual([])
                  }))
              }))
            expect(yield* failures).toEqual([])
          })
      ))

    it.scoped("under reduced motion the search still has frames, and merges and story changes move only by opacity", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" })
        yield* act(() => page.addInitScript(recordPaperFrames))
        yield* goto(page, "/")
        yield* visible(rendered(page))
        // Nothing animates a geometric property. The title, the step headers and the paper stand only where
        // they stood before or where they stand after — never between. The discs are drawn by a real search:
        // each trial is a complete drawing, so a disc may stand somewhere new when a trial arrives, but between
        // two trials it does not move at all. A sample belongs to the drawing of one search's trial: the trace
        // counts up through a search and starts again at nothing for the next, so a fall in the count begins
        // a new search.
        const sample = Effect.map(act(() => page.evaluate(motionSample)), (frame) => ({
          ...frame,
          placed: Record.fromEntries(frame.placed)
        }))
        const drawings = (frames: ReadonlyArray<{ readonly trials: number }>): ReadonlyArray<string> =>
          Arr.drop(
            Arr.scan(frames, { search: 0, trials: -1 }, (previous, frame) => ({
              search: frame.trials < previous.trials ? previous.search + 1 : previous.search,
              trials: frame.trials
            })),
            1
          ).map((drawing) => `search ${String(drawing.search)}, trial ${String(drawing.trials)}`)
        const landmarks = ["h1", "compose", "arrange", "paper"]
        const onlyOpacityAcross = (change: Effect.Effect<void, unknown>) =>
          Effect.gen(function*() {
            const before = yield* sample
            yield* change
            const samples = yield* Stream.repeatEffectWithSchedule(
              sample,
              Schedule.spaced("16 millis").pipe(Schedule.upTo("2 seconds"))
            ).pipe(Stream.runCollect, Effect.map(Chunk.toReadonlyArray))
            yield* visible(rendered(page))
            yield* animationsSettled(page)
            const after = yield* sample
            const properties = Arr.dedupe(Arr.flatMap(samples, (frame) => frame.properties))
            expect(Arr.difference(properties, opacityAndColour)).toEqual([])
            const retained = Arr.intersection(Record.keys(before.placed), Record.keys(after.placed))
            expect(Arr.difference(landmarks, retained)).toEqual([])
            const drawn = Arr.zip(drawings(samples), samples)
            Arr.forEach(retained, (name) => {
              const stoodAt = (frames: ReadonlyArray<typeof before>) =>
                Arr.dedupe(Arr.filterMap(frames, (frame) => Record.get(frame.placed, name)))
              const ends = [before.placed[name] ?? "", after.placed[name] ?? ""]
              if (Arr.contains(landmarks, name)) {
                expect(Arr.difference(stoodAt(samples), ends), name).toEqual([])
                return
              }
              Arr.forEach(Arr.dedupe(Arr.map(drawn, ([drawing]) => drawing)), (drawing) => {
                const during = stoodAt(
                  Arr.filterMap(drawn, ([of, frame]) => of === drawing ? Option.some(frame) : Option.none())
                )
                expect(during.length, `${name} during ${drawing}`).toBeLessThanOrEqual(1)
              })
            })
            return properties
          })
        const merge = page.getByRole("switch", { checked: false, name: /^Merge Ship's bell/u })
        yield* act(() => merge.scrollIntoViewIfNeeded())
        yield* onlyOpacityAcross(click(merge))
        const story = page.getByRole("radiogroup", { name: "Scenario" }).getByRole("radio", {
          name: placeScenarioMeta["lost-market"].label
        })
        yield* act(() => story.scrollIntoViewIfNeeded())
        yield* onlyOpacityAcross(click(story))
        // The search is a real process: it drew more than one trial on the way to the kept one.
        const trials = Arr.dedupe(
          (yield* act(() => page.evaluate(recordedPaperFrames))).split("\n").filter((frame) =>
            frame.includes("running")
          )
        )
        expect(trials.length).toBeGreaterThanOrEqual(2)
        expect(yield* failures).toEqual([])
      }))

    it.scoped("light and dark keep every interactive state readable", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 1280, height: 800 } })
        // Each scheme changes to a story the page is not already showing, so the search runs.
        yield* Effect.forEach(Arr.zip(colorSchemes, Arr.drop(placeScenarios, 1)), ([scheme, scenario]) =>
          Effect.gen(function*() {
            yield* setColorScheme(page, scheme)
            yield* goto(page, "/")
            yield* visible(rendered(page))
            // An answer open.
            yield* focus(page.locator("[data-place-marker]").last())
            yield* press(page, "Enter")
            const answer = page.locator("[data-place-provenance]")
            yield* visible(answer)
            yield* readable(answer)
            yield* press(page, "Escape")
            // The band shown, with the Build act lit.
            const build = page.locator("[data-place-act='build']")
            yield* act(() =>
              build.evaluate(scrollElementTo, 0)
            )
            const bandLink = page.locator("[data-place-band] a")
            yield* visible(bandLink)
            yield* readable(bandLink)
            yield* hover(build.locator("[data-place-code-line]").first())
            const litLine = build.locator("[data-code-line-focused]")
            yield* visible(litLine)
            yield* readable(litLine)
            // A search running, then the story changed.
            yield* click(
              page.getByRole("radiogroup", { name: "Scenario" }).getByRole("radio", {
                name: placeScenarioMeta[scenario].label
              })
            )
            const caption = page.locator("[data-place-search-caption]")
            yield* until(act(() => caption.innerText()), (text) => text.length > 0, "the search's caption")
            yield* readable(caption)
            yield* storyTaken(page, scenario)
            expect(yield* act(() => page.evaluate(paperProseContrast))).toBeGreaterThanOrEqual(4.5)
          }))
        expect(yield* failures).toEqual([])
      }))
  }
)
