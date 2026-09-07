// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import type { Locator, Page } from "@playwright/test"
import { Chunk, Duration, Effect, Fiber, Layer, Option, Order, Schedule, Schema, Stream } from "effect"
import * as Arr from "effect/Array"
import * as Str from "effect/String"

import { renderTrials } from "../../app/contracts/demo/imagined-place-search.js"
import { placeStepDefinitions } from "../../app/web/view/home/placeSteps.js"
import type { ReducedMotion } from "./browser.js"
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
  setViewport,
  until,
  urlMatches,
  visible
} from "./browser.js"
import {
  activeElementOpensDocsLink,
  activeElementRole,
  currentLocation,
  discsAtRest,
  insideViewportRight,
  isActiveElement,
  markerPositionsInStage,
  mergeFrame,
  stageAndColumnWidths,
  stageLayout
} from "./platform/in-page.js"
import { SiteLive } from "./site.js"

const rendered = (page: Page) => page.locator("[data-place-render-phase='complete']")

/** Every disc's position relative to the stage, so scrolling cannot move it. */
const markerPositions = (page: Page) => () => page.locator("[data-place-marker]").evaluateAll(markerPositionsInStage)

const FeaturePlace = Schema.Struct({
  kind: Schema.Literal("ring", "disc"),
  translate: Schema.String,
  transform: Schema.String
})
type FeaturePlace = typeof FeaturePlace.Type

/** One frame of the stage during a merge: where the feature is painted, and any line of prose painted over a disc. */
const MergeFrame = Schema.Struct({
  places: Schema.Array(FeaturePlace),
  overlaps: Schema.Array(Schema.String)
})
type MergeFrame = typeof MergeFrame.Type

const landed = (frame: MergeFrame): boolean =>
  Arr.some(frame.places, (place) => place.kind === "disc" && place.transform === "none")

/**
 * The stage sampled a frame apart from now until the feature `name` has a
 * disc filled in and at rest — that frame included — or for `atMost`.
 */
const framesUntilLanded = (region: Locator, name: string, atMost: Duration.Duration) =>
  Stream.repeatEffectWithSchedule(
    act(() => region.evaluate(mergeFrame, name)),
    Schedule.spaced("16 millis").pipe(Schedule.upTo(atMost))
  ).pipe(
    Stream.takeUntil(landed),
    Stream.runCollect,
    Effect.map(Chunk.toReadonlyArray)
  )

/** Every distinct `translate` the feature's `kind` was painted at, in order of first sight. */
const placesOf = (frames: ReadonlyArray<MergeFrame>, kind: FeaturePlace["kind"]): ReadonlyArray<string> =>
  Arr.dedupe(
    Arr.filterMap(
      Arr.flatMap(frames, (frame) => frame.places),
      (place) => place.kind === kind ? Option.some(place.translate) : Option.none()
    )
  )

/**
 * Merges the declined program proposal and reports every frame painted
 * inside the demo until the merge lands. While the search makes room for the
 * feature, a ring marks the room on the stage and the sheet holds its size;
 * when the search settles, the disc fills the ring where it last stood, and
 * at no frame is a line of prose painted over a disc.
 */
const mergeProgramProposal = (reducedMotion: ReducedMotion) =>
  Effect.gen(function*() {
    const { failures, page } = yield* openPage({ reducedMotion })
    yield* goto(page, "/")
    yield* visible(rendered(page))
    const demo = page.getByRole("region", { name: "Imagined place demo" })
    const proposal = demo.locator("[data-place-proposal='program']")
    const feature = proposal.locator("[data-place-feature]")
    const name = yield* Option.fromNullable(yield* act(() => feature.getAttribute("data-place-feature")))
    const disc = demo.locator(`[data-place-marker="${name}"]`)
    yield* count(disc, 0)
    const paper = page.locator("[data-place-stage='paper']")
    const sheetHeight = () => paper.getAttribute("data-place-stage-height")
    const keptHeight = yield* act(sheetHeight)

    const rebuild = yield* Effect.fork(nextResponse(page, "POST", "/api/imagined-place/build"))
    yield* click(proposal.getByRole("switch"))
    // Sample every frame from the moment the merge is requested until the disc is filled in.
    const painted = yield* Effect.fork(framesUntilLanded(demo, name, Duration.seconds(12)))
    expect((yield* Fiber.join(rebuild)).status()).toBe(200)
    const ring = demo.locator(`[data-place-marker-arriving="${name}"]`)
    yield* visible(ring)
    yield* attribute(paper, "data-place-drawn", "sketch")
    expect(yield* act(sheetHeight)).toBe(keptHeight)
    yield* visible(disc)
    yield* count(ring, 0)
    yield* attribute(paper, "data-place-drawn", "kept")
    const frames = yield* Fiber.join(painted)
    const rings = placesOf(frames, "ring")
    const discs = placesOf(frames, "disc")
    return {
      failures,
      name,
      // The disc fills the ring: it is only ever painted where the ring last stood.
      filledInPlace: Arr.getEquivalence(Str.Equivalence)(discs, Arr.takeRight(rings, 1)),
      // How many places the disc was painted at: one when it never moves.
      placed: Arr.length(discs),
      // The disc arrives with Motion in place, so it is painted at more than one transform on its way in.
      arrivals: Arr.length(
        Arr.dedupe(
          Arr.filterMap(
            Arr.flatMap(frames, (frame) => frame.places),
            (place) => place.kind === "disc" ? Option.some(place.transform) : Option.none()
          )
        )
      ),
      overlaps: Arr.dedupe(Arr.flatMap(frames, (frame) => frame.overlaps))
    }
  })

const referenceTargets = (references: Locator) =>
  Effect.gen(function*() {
    const total = yield* act(() => references.count())
    expect(total).toBeGreaterThan(0)
    return yield* Effect.forEach(Arr.range(0, total - 1), (index) =>
      Effect.gen(function*() {
        const reference = references.nth(index)
        const text = yield* Option.fromNullable(yield* act(() => reference.getAttribute("data-place-reference")))
        const href = yield* Option.fromNullable(yield* act(() => reference.getAttribute("href")))
        return { text, href }
      }))
  })

layer(Layer.merge(SiteLive, BrowserLive), { excludeTestServices: true, timeout: "3 minutes" })(
  "Theoria home page demo in Chromium",
  (it) => {
    it.scoped("the search trace draws any trial, returns to the kept one, and content IDs open in full", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 390, height: 844 } })
        yield* goto(page, "/")
        yield* visible(rendered(page))
        yield* count(page.locator("[data-place-step]"), placeStepDefinitions.length)
        yield* visible(page.locator("[data-place-marker]").first())

        const caption = page.locator("[data-place-search-caption]")
        yield* containsText(caption, "Kept trial")
        // The disc of the merged feature is still travelling from its name when the search settles; the kept positions are where it lands.
        yield* eventually(() => page.getByRole("region", { name: "Imagined place demo" }).evaluate(discsAtRest), true)
        const positions = markerPositions(page)
        const kept = yield* act(positions)
        // The sheet and the slider under the pointer must not move while trials are swapped.
        const paper = page.locator("[data-place-stage='paper']")
        const layout = () => page.evaluate(stageLayout)
        yield* focus(page.getByRole("slider", { name: "Trial drawn on the stage" }))
        // Focusing scrolls the slider into view; from here on nothing may move it.
        const atRest = yield* act(layout)
        yield* press(page, "Home")
        yield* containsText(caption, "Trial 1 of")
        yield* containsText(caption, "not kept")
        expect(yield* act(positions)).not.toBe(kept)
        expect(yield* act(layout)).toBe(atRest)
        // Trial 1 runs longer than the kept sheet: it is cut with a fade and scrolls, never clipped silently.
        yield* attribute(paper, "data-overflow-y-end", "")

        yield* press(page, "End")
        // The last trial may itself be the kept one, so only the position is asserted here.
        yield* containsText(caption, new RegExp(`[Tt]rial ${String(renderTrials)} of ${String(renderTrials)}`, "u"))
        expect(yield* act(layout)).toBe(atRest)
        yield* press(page, "Escape")
        yield* eventually(() => paper.evaluate((element) => element.hasAttribute("data-has-overflow-y")), false)
        yield* containsText(caption, "Kept trial")
        yield* count(page.locator("[data-place-show-kept]"), 0)

        yield* press(page, "Home")
        yield* click(page.locator("[data-place-show-kept]"))
        yield* containsText(caption, "Kept trial")
        yield* eventually(positions, kept)

        const contentId = page.locator("[data-place-content-id]").first()
        yield* hover(contentId)
        yield* attribute(contentId, "data-popup-open", "")
        yield* visible(page.getByText("Click to copy"))
        expect(yield* failures).toEqual([])
      }))

    it.scoped("the neighbor's note is a fold, and a merged proposal stands beside its line of prose", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* goto(page, "/")
        yield* visible(rendered(page))
        const demo = page.getByRole("region", { name: "Imagined place demo" })

        // Closed, the fold is the envelope: the seal and its size. The words wait for the author's key.
        const fold = demo.locator("[data-place-sealed-note]")
        const trigger = fold.getByRole("button")
        yield* visible(fold.getByText(/Sealed note · \d+ bytes/u))
        yield* hidden(fold.getByText("Opened with your key"))
        yield* hidden(fold.locator("blockquote"))
        yield* click(trigger)
        yield* visible(fold.getByText("Opened with your key"))
        yield* hidden(fold.getByText(/Sealed note · \d+ bytes/u))
        yield* visible(fold.locator("blockquote"))
        yield* containsText(fold.locator("blockquote"), /“.+”/u)
        yield* click(trigger)
        yield* hidden(fold.locator("blockquote"))
        yield* visible(fold.getByText(/Sealed note · \d+ bytes/u))

        // The merged proposal knows the drawn line its sentence starts on; the declined one is not in the prose.
        const neighbor = demo.locator("[data-place-proposal='neighbor']")
        const line = yield* Option.fromNullable(yield* act(() => neighbor.getAttribute("data-place-anchor-line")))
        const adds = yield* act(() => neighbor.getByRole("definition").first().innerText())
        const firstWord = Option.getOrElse(Arr.head(adds.split(" ")), () => adds)
        yield* containsText(demo.locator(`[data-place-line='${line}']`), firstWord)
        yield* count(demo.locator("[data-place-proposal='program'][data-place-anchor-line]"), 0)
        expect(yield* failures).toEqual([])
      }))

    it.scoped("a merged feature fills the room the search made for it, never over the prose", () =>
      Effect.gen(function*() {
        const { arrivals, failures, filledInPlace, overlaps } = yield* mergeProgramProposal("no-preference")
        expect(filledInPlace).toBe(true)
        expect(arrivals).toBeGreaterThanOrEqual(2)
        expect(overlaps).toEqual([])
        expect(yield* failures).toEqual([])
      }))

    it.scoped("under reduced motion the feature is placed outright, never over the prose", () =>
      Effect.gen(function*() {
        const { arrivals, failures, overlaps, placed } = yield* mergeProgramProposal("reduce")
        // Nothing travels: the drawing is placed outright at every best, the disc at the kept
        // arrangement's the moment the trials are in — not where the ring last stood, when the
        // last trial is the best. Motion drops the scale too, so the disc is at rest from its first frame.
        expect(placed).toBe(1)
        expect(arrivals).toBe(1)
        expect(overlaps).toEqual([])
        expect(yield* failures).toEqual([])
      }))

    it.scoped("keyboard reaches every control", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* goto(page, "/")
        yield* visible(rendered(page))
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
        yield* visible(rendered(page))
        // Shrinks to 320 first, then grows: the stage must follow the column both ways.
        const stages = yield* Effect.forEach(Arr.make(320, 390, 820, 1280, 1680), (width) =>
          Effect.gen(function*() {
            yield* setViewport(page, { width, height: 900 })
            yield* visible(rendered(page))
            yield* animationsSettled(page)
            expect(yield* overflowingElements(page)).toEqual([])
            expect(yield* fitsViewport(page)).toBe(true)
            // The stage is drawn for exactly the width inside the frame's border, and the frame fits the column.
            const widths = yield* until(
              act(() => page.evaluate(stageAndColumnWidths)),
              ({ column, drawable, frame, stage }) => stage > 0 && drawable === stage && frame <= column,
              `the stage and its frame fit the column at ${String(width)}px`
            )
            return widths.stage
          }))
        expect(stages).toEqual(Arr.sort(stages, Order.number))
        expect(Arr.lastNonEmpty(stages)).toBeGreaterThan(Arr.headNonEmpty(stages))
        expect(yield* failures).toEqual([])
      }))

    it.scoped("how it's built links every symbol to an existing reference anchor and shows values from the build", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* goto(page, "/")
        yield* visible(rendered(page))

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
        yield* visible(rendered(page))

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
  }
)
