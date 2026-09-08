// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import type { Locator, Page } from "@playwright/test"
import { Chunk, Duration, Effect, Fiber, Layer, Match, Option, Order, Schedule, Schema, Stream } from "effect"
import * as Arr from "effect/Array"

import { stageMaxWidth } from "../../app/contracts/demo/imagined-place-flow.js"
import { codeSite, CodeSiteId } from "../../app/contracts/demo/imagined-place-provenance.js"
import { renderTrials } from "../../app/contracts/demo/imagined-place-search.js"
import { type PlaceScenario, placeScenarioMeta, placeScenarios } from "../../app/contracts/imagined-place.js"
import { howItsBuiltActionLabel } from "../../app/web/view/home/HomeHero.js"
import { placeStepDefinitions } from "../../app/web/view/home/placeSteps.js"
import type { ColorScheme, ReducedMotion, Viewport } from "./browser.js"
import {
  act,
  animationsSettled,
  attached,
  attribute,
  BrowserLive,
  click,
  containsText,
  count,
  desktop,
  eventually,
  fitsViewport,
  focus,
  goto,
  hidden,
  hover,
  nextResponse,
  openPage,
  overflowingElements,
  phone,
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
  answerPopupsShowing,
  bandDiscCentre,
  bandShowsKept,
  canvasColour,
  currentLocation,
  discsAtRest,
  documentTop,
  finishingTouches,
  focusLanding,
  insideViewportRight,
  isActiveElement,
  leaversGone,
  markerLegendMetrics,
  markerPositionsInStage,
  paperProseContrast,
  recordedPaperFrames,
  recordPaperFrames,
  scrollAffordance,
  scrollElementTo,
  scrollPast,
  scrollToTop,
  stageAndColumnWidths,
  stageFrame,
  stageLayout,
  storyDrawn,
  surfacePaint,
  textColour,
  textFitsItsBox,
  transitionOf
} from "./platform/in-page.js"
import { SiteLive } from "./site.js"

const rendered = (page: Page) => page.locator("[data-place-render-phase='complete']")

/** Both modes the page is read in. */
const colorSchemes: ReadonlyArray<ColorScheme> = ["light", "dark"]

/**
 * How many failures the stage tells (`StageFailed`, the search caption's row
 * when the build or the drawing failed), sampled a frame apart from now until
 * the place is drawn. A build still on its way is waiting, not failed, so
 * before the first frame there is nothing to report.
 */
const stageFailuresUntilRendered = (page: Page) =>
  Stream.repeatEffectWithSchedule(
    act(() => page.locator("[data-place-stage-failed]").count()),
    Schedule.spaced("16 millis")
  ).pipe(
    Stream.interruptWhen(visible(rendered(page))),
    Stream.runCollect,
    Effect.map(Chunk.toReadonlyArray)
  )

/** One sample of the paper: its reported height, if there is a paper, and the search's phase, if a trial is in. */
const PaperSample = Schema.Struct({
  height: Schema.Option(Schema.String),
  phase: Schema.Option(Schema.String)
})
type PaperSample = typeof PaperSample.Type

const paperSample = (reported: string): PaperSample => {
  const [height = "-", phase = "-"] = reported.split(" ")
  return PaperSample.make({
    height: height === "-" ? Option.none() : Option.some(height),
    phase: phase === "-" ? Option.none() : Option.some(phase)
  })
}

const landing = (sample: PaperSample): boolean =>
  Option.exists(sample.phase, (phase) => phase === "landing" || phase === "complete")

/** Records the paper on every animation frame of every document the page loads from now on. */
const recordPaper = (page: Page) => act(() => page.addInitScript(recordPaperFrames))

/**
 * Every change to the paper recorded from the document's first frame until
 * the search lands its drawing. Before the first trial is in, the paper is the
 * one the search is expected to want; while the trials run, the first frame
 * holds it; so every height until landing is one height.
 */
const paperUntilLanding = (page: Page) =>
  Effect.map(
    act(() => page.evaluate(recordedPaperFrames)),
    (recorded) => Arr.takeWhile(Arr.map(recorded.split("\n"), paperSample), (sample) => !landing(sample))
  )

/** Every disc's position relative to the stage, so scrolling cannot move it. */
const markerPositions = (page: Page) => () => page.locator("[data-place-marker]").evaluateAll(markerPositionsInStage)

const FeaturePlace = Schema.Struct({
  name: Schema.String,
  kind: Schema.Literal("ring", "disc"),
  translate: Schema.String,
  transform: Schema.String
})
type FeaturePlace = typeof FeaturePlace.Type

/** A set of prose lines standing on the stage: the text it sets, and whether it is painted at all. */
const LineSet = Schema.Struct({
  text: Schema.String,
  painted: Schema.Boolean
})

/**
 * One frame of the stage while its drawing changes: where every feature is
 * painted, which sets of lines stand, and any line of prose painted over a disc.
 */
const StageFrame = Schema.Struct({
  phase: Schema.String,
  places: Schema.Array(FeaturePlace),
  lines: Schema.Array(LineSet),
  overlaps: Schema.Array(Schema.String)
})
type StageFrame = typeof StageFrame.Type

/** The frame's places of one feature. */
const placesIn = (frame: StageFrame, name: string): ReadonlyArray<FeaturePlace> =>
  Arr.filter(frame.places, (place) => place.name === name)

/** The feature `name` has a disc filled in and at rest in the frame. */
const landed = (name: string) => (frame: StageFrame): boolean =>
  Arr.some(placesIn(frame, name), (place) => place.kind === "disc" && place.transform === "none")

/**
 * The stage sampled a frame apart from now until `done` holds of a frame —
 * that frame included — or for `atMost`.
 */
const framesUntil = (region: Locator, done: (frame: StageFrame) => boolean, atMost: Duration.Duration) =>
  Stream.repeatEffectWithSchedule(
    act(() => region.evaluate(stageFrame)),
    Schedule.spaced("16 millis").pipe(Schedule.upTo(atMost))
  ).pipe(
    Stream.takeUntil(done),
    Stream.runCollect,
    Effect.map(Chunk.toReadonlyArray)
  )

/** Every distinct `translate` the feature's `kind` was painted at, in order of first sight. */
const placesOf = (
  frames: ReadonlyArray<StageFrame>,
  name: string,
  kind: FeaturePlace["kind"]
): ReadonlyArray<string> =>
  Arr.dedupe(
    Arr.filterMap(
      Arr.flatMap(frames, (frame) => placesIn(frame, name)),
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
    const painted = yield* Effect.fork(framesUntil(demo, landed(name), Duration.seconds(12)))
    expect((yield* Fiber.join(rebuild)).status()).toBe(200)
    const ring = demo.locator(`[data-place-marker-arriving="${name}"]`)
    yield* visible(ring)
    yield* attribute(paper, "data-place-drawn", "sketch")
    expect(yield* act(sheetHeight)).toBe(keptHeight)
    yield* visible(disc)
    yield* count(ring, 0)
    yield* attribute(paper, "data-place-drawn", "kept")
    const frames = yield* Fiber.join(painted)
    const feature_ = Arr.map(frames, (frame) => placesIn(frame, name))
    const discs = placesOf(frames, name, "disc")
    // The frames of the hand-off itself: the ring still leaving as the disc arrives.
    const handingOff = Arr.filter(
      feature_,
      (places) =>
        Arr.some(places, (place) => place.kind === "ring") && Arr.some(places, (place) => place.kind === "disc")
    )
    return {
      failures,
      name,
      // The disc fills the ring: the hand-off is painted, and at every frame of it both stand in one place.
      filledInPlace: Arr.isNonEmptyReadonlyArray(handingOff) &&
        Arr.every(handingOff, (places) => Arr.dedupe(Arr.map(places, (place) => place.translate)).length === 1),
      // How many places the disc was painted at: one when it never moves.
      placed: Arr.length(discs),
      // The disc arrives with Motion in place, so it is painted at more than one transform on its way in.
      arrivals: Arr.length(
        Arr.dedupe(
          Arr.filterMap(
            Arr.flatten(feature_),
            (place) => place.kind === "disc" ? Option.some(place.transform) : Option.none()
          )
        )
      ),
      overlaps: Arr.dedupe(Arr.flatMap(frames, (frame) => frame.overlaps))
    }
  })

/**
 * The drawing as it stands in the frame: every disc by name and place, one
 * line each, in a fixed order — so two frames of the same drawing read the
 * same, whether or not a disc's old element is still leaving over its new one.
 */
const drawingStands = (frame: StageFrame): string =>
  Arr.join(
    Arr.sort(
      Arr.dedupe(
        Arr.filterMap(
          frame.places,
          (place) => place.kind === "disc" ? Option.some(`${place.name}@${place.translate}`) : Option.none()
        )
      ),
      Order.string
    ),
    "\n"
  )

/** The text of every set of lines painted in the frame. */
const paintedSets = (frame: StageFrame): ReadonlyArray<string> =>
  Arr.filterMap(frame.lines, (set) => set.painted ? Option.some(set.text) : Option.none())

/** A set of lines other than those in `known` is painted in the frame. */
const paintsNewSet = (frame: StageFrame, known: ReadonlyArray<string>): boolean =>
  Arr.some(paintedSets(frame), (text) => !Arr.contains(known, text))

/**
 * Changes the story and reports every frame painted inside the demo until the
 * new drawing is kept and landed. The lines set from the old story leave
 * before anything moves, and the discs wait for the new lines to stand: the
 * first frame in which any disc is drawn elsewhere than it stood is no
 * earlier than the first frame in which the new set is painted, and at no
 * frame is a line of prose painted over a disc.
 */
const changeStory = () =>
  Effect.gen(function*() {
    const { failures, page } = yield* openPage()
    yield* goto(page, "/")
    yield* visible(rendered(page))
    const demo = page.getByRole("region", { name: "Imagined place demo" })
    yield* eventually(() => demo.evaluate(storyDrawn), true)
    const before = yield* act(() => demo.evaluate(stageFrame))
    const standing = drawingStands(before)
    const oldSets = paintedSets(before)
    const oldNames = Arr.dedupe(Arr.map(before.places, (place) => place.name))
    const scenarios = demo.getByRole("radiogroup", { name: "Scenario" })
    const radio = scenarios.getByRole("radio", { checked: false }).first()
    // The new story's drawing, kept and landed: the phase is the search's own, so the old story's
    // `complete` is told from the new one's by the new lines standing over a drawing that has moved.
    const kept = (frame: StageFrame): boolean =>
      frame.phase === "complete" && paintsNewSet(frame, oldSets) && drawingStands(frame) !== standing

    // Sample every frame from before the story is chosen until the new drawing is kept.
    const painted = yield* Effect.fork(framesUntil(demo, kept, Duration.seconds(20)))
    const rebuild = yield* Effect.fork(nextResponse(page, "POST", "/api/imagined-place/build"))
    yield* click(radio)
    expect((yield* Fiber.join(rebuild)).status()).toBe(200)
    yield* eventually(() => demo.evaluate(storyDrawn), true)
    // Once the new drawing has landed, every disc of the old story has shrunk away and gone.
    yield* eventually(() => demo.evaluate(leaversGone), true)
    const frames = yield* Fiber.join(painted)
    // The first frame the drawing is elsewhere than it stood, and the first the new lines are painted in.
    const moved = Arr.findFirstIndex(frames, (frame) => drawingStands(frame) !== standing)
    const newLines = Arr.findFirstIndex(frames, (frame) => paintsNewSet(frame, oldSets))
    return {
      failures,
      frames: frames.length,
      moved,
      newLines,
      // A frame with two sets painted would be two texts over each other.
      twoSets: Arr.some(frames, (frame) => paintedSets(frame).length > 1),
      overlaps: Arr.dedupe(Arr.flatMap(frames, (frame) => frame.overlaps)),
      // The old story's discs are still drawn in the first frame the drawing moves — shrinking away where
      // they stood, the lines flowed around them — rather than dropped the moment it does.
      leaversShrink: Option.exists(
        Option.flatMap(moved, (index) => Arr.get(frames, index)),
        (frame) => Arr.some(frame.places, (place) => place.kind === "disc" && Arr.contains(oldNames, place.name))
      )
    }
  })

/**
 * From a mark's answer to the line of code it credits, opened and followed by
 * pointer or by keyboard, from a disc on the paper or a line of its prose, at
 * any viewport. Reports the step selected, where focus landed, the URL's
 * fragment and whether the answer is still on the page — the route lands on
 * the credited line itself, mid-viewport, with the answer gone.
 */
const fromAnswerToItsCode = (
  opening: "pointer" | "keyboard",
  reducedMotion: ReducedMotion,
  from: "disc" | "line" = "disc",
  viewport: Viewport = desktop
) =>
  Effect.gen(function*() {
    const { failures, page } = yield* openPage({ reducedMotion, viewport })
    yield* goto(page, "/")
    yield* visible(rendered(page))
    const demo = page.getByRole("region", { name: "Imagined place demo" })
    const overlay = page.locator("[data-place-provenance]")
    const mark = Match.value(from).pipe(
      Match.when("disc", () => demo.locator("[data-place-marker]").first()),
      Match.when("line", () =>
        demo.getByRole("toolbar", { name: "Lines of the prose" }).locator("[data-place-line='0']")),
      Match.exhaustive
    )
    const codeLink = overlay.locator("[data-place-provenance-code]")

    yield* act(() =>
      mark.scrollIntoViewIfNeeded()
    )
    yield* Match.value(opening).pipe(
      Match.when("pointer", () => click(mark)),
      Match.when("keyboard", () =>
        Effect.gen(function*() {
          yield* focus(mark)
          yield* press(page, "Enter")
        })),
      Match.exhaustive
    )
    yield* visible(overlay)
    const siteId = yield* Schema.decodeUnknown(CodeSiteId)(
      yield* act(() => codeLink.getAttribute("data-place-provenance-code"))
    )
    const site = codeSite(siteId)
    const step = yield* Arr.findFirst(placeStepDefinitions, (definition) => definition.id === site.step)

    yield* Match.value(opening).pipe(
      Match.when("pointer", () => click(codeLink)),
      Match.when("keyboard", () =>
        Effect.gen(function*() {
          // Tab walks from the pinned answer's first control to the credited line's link.
          yield* Effect.iterate(false, {
            while: (reached) => !reached,
            body: () =>
              Effect.gen(function*() {
                yield* press(page, "Tab")
                return yield* act(() => codeLink.evaluate(isActiveElement))
              })
          }).pipe(
            Effect.timeoutFail({ duration: Duration.seconds(5), onTimeout: () => "the code link was never reached" })
          )
          yield* press(page, "Enter")
        })),
      Match.exhaustive
    )

    yield* urlMatches(page, /#how-its-built$/u)
    const section = page.locator("[data-place-how-its-built]")
    yield* attribute(section.getByRole("tab", { name: step.name }), "aria-selected", "true")
    const gutterMark = section.locator(`[data-place-code-site="${siteId}"]`)
    yield* eventually(() => gutterMark.evaluate(isActiveElement), true)
    yield* hidden(overlay)
    // A smooth scroll takes its frames; an instant one has landed by the time focus has.
    const landing = yield* Match.value(reducedMotion).pipe(
      Match.when("reduce", () => act(() => page.evaluate(focusLanding))),
      Match.when("no-preference", () =>
        until(act(() => page.evaluate(focusLanding)), (landed) => landed.inViewport, "the line is in the viewport")),
      Match.exhaustive
    )
    return { failures, landing, siteId, step: step.id }
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
        // Sample every frame from before the page is asked for until the place is drawn.
        const told = yield* Effect.fork(stageFailuresUntilRendered(page))
        yield* recordPaper(page)
        yield* goto(page, "/")
        yield* visible(rendered(page))
        // Nothing has failed while the build and the first drawing are on their way.
        expect(Arr.filter(yield* Fiber.join(told), (shown) => shown > 0)).toEqual([])
        // The paper is cut to size before the first trial is in, and holds that size until the drawing lands.
        const papers = yield* paperUntilLanding(page)
        expect(Arr.some(papers, (sample) => Option.isSome(sample.height) && Option.isNone(sample.phase))).toBe(true)
        expect(Arr.dedupe(Arr.filterMap(papers, (sample) => sample.height))).toHaveLength(1)
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
        // Trial 1 runs longer than the kept sheet: it is cut with a fade and scrolls, never clipped silently —
        // and on a phone, where nothing hovers, the scrollbar is painted for as long as there is more to see.
        yield* attribute(paper, "data-overflow-y-end", "")
        const cut = yield* until(
          act(() => paper.evaluate(scrollAffordance)),
          (affordance) => affordance.scrollbarPainted && affordance.fadePainted,
          "the paper's scrollbar and fade painted"
        )
        expect(cut.overflows).toBe(true)
        expect(cut.thumbHeight).toBeGreaterThan(0)

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
        const wholeId = yield* act(() => contentId.getAttribute("data-place-content-id"))
        yield* hover(contentId)
        yield* attribute(contentId, "data-popup-open", "")
        const whole = page.locator("[data-place-provenance] [data-place-provenance-value]")
        yield* visible(whole)
        expect(yield* act(() => whole.textContent())).toBe(wholeId)
        // The whole ID is read, not only copied: at 390 px it breaks wherever the answer's width falls, clipped nowhere.
        expect(yield* act(() => whole.locator(":scope > *").first().evaluate(textFitsItsBox))).toBe(true)
        yield* visible(page.locator("[data-place-provenance] [data-place-provenance-copy]"))
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

        // The merged proposal's name lights the drawn line its sentence starts on; the declined one is not in the prose.
        const neighbor = demo.locator("[data-place-proposal='neighbor']")
        const adds = yield* act(() => neighbor.getByRole("definition").first().innerText())
        const firstWord = Option.getOrElse(Arr.head(adds.split(" ")), () => adds)
        yield* hover(neighbor.locator("[data-place-feature]"))
        const lit = demo.locator("[data-place-line][data-place-focused]")
        yield* eventually(() => lit.count(), 1)
        yield* containsText(lit, firstWord)
        yield* hover(demo.locator("[data-place-proposal='program'] [data-place-feature]"))
        yield* eventually(() => lit.count(), 0)
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
        const { arrivals, failures, filledInPlace, overlaps, placed } = yield* mergeProgramProposal("reduce")
        // Nothing travels: the drawing is placed outright at every best, and the disc fills the
        // ring by opacity alone — no scale is written for Motion to cancel, so the disc is at rest
        // from its first frame.
        expect(filledInPlace).toBe(true)
        expect(placed).toBe(1)
        expect(arrivals).toBe(1)
        expect(overlaps).toEqual([])
        expect(yield* failures).toEqual([])
      }))

    it.scoped("a changed story's discs wait for its lines: the old set leaves, the new set stands, then the drawing moves and the old discs shrink away", () =>
      Effect.gen(function*() {
        const { failures, frames, leaversShrink, moved, newLines, overlaps, twoSets } = yield* changeStory()
        // The drawing moved, and the new lines were painted, within the frames sampled.
        expect(frames).toBeGreaterThan(2)
        expect(Option.isSome(moved)).toBe(true)
        expect(Option.isSome(newLines)).toBe(true)
        // The drawing rests until the new set stands: it is never drawn elsewhere while the old set is still leaving.
        expect(Option.getOrElse(moved, () => -1)).toBeGreaterThanOrEqual(Option.getOrElse(newLines, () => -1))
        expect(twoSets).toBe(false)
        // The old story's discs go as the drawing travels — shrinking where they stood, the text flowed around
        // them to the last — and are gone once it lands (`changeStory` waits on that); at no frame is a line
        // over any disc, going or coming.
        expect(leaversShrink).toBe(true)
        expect(overlaps).toEqual([])
        expect(yield* failures).toEqual([])
      }))

    /**
     * Two finishing touches follow a merge: the version that changed is washed
     * in the digest tone until it settles, and once the search settles the walk
     * through the place draws itself, front to back. Both are Motion's, under
     * the page's one configuration. The walk is movement, so under reduced
     * motion it is drawn whole from its first frame; the wash is colour alone,
     * which reduced motion keeps.
     */
    it.scoped("a merge washes the changed version and the settled search draws the walk once; under reduced motion the walk is whole at once", () =>
      Effect.gen(function*() {
        const finishing = (reducedMotion: ReducedMotion) =>
          Effect.gen(function*() {
            const { failures, page } = yield* openPage({ reducedMotion })
            yield* goto(page, "/")
            yield* visible(rendered(page))
            const paper = page.locator("[data-place-stage='paper']")
            yield* attribute(paper, "data-place-drawn", "kept")
            const merge = page.getByRole("switch", { checked: false, name: /^Merge Ship's bell/u })
            yield* act(() => merge.scrollIntoViewIfNeeded())
            // The kept drawing and its walk stand until the merged build lands; sampling starts once the new
            // search is drawing, or the first sample would be the old walk, already whole.
            const rebuilt = yield* Effect.fork(nextResponse(page, "POST", "/api/imagined-place/build"))
            yield* click(merge)
            expect((yield* Fiber.join(rebuilt)).status()).toBe(200)
            yield* attribute(paper, "data-place-drawn", "sketch")
            // Every frame from the merged search's first trial until the walk is whole.
            const frames = yield* Stream.repeatEffectWithSchedule(
              act(() => page.evaluate(finishingTouches)),
              Schedule.spaced("16 millis").pipe(Schedule.upTo("14 seconds"))
            ).pipe(
              Stream.takeUntil((frame) => frame.walk === 1),
              Stream.runCollect,
              Effect.map(Chunk.toReadonlyArray)
            )
            yield* animationsSettled(page)
            const settled = yield* act(() => page.evaluate(finishingTouches))
            expect(yield* failures).toEqual([])
            return {
              walks: Arr.dedupe(Arr.filter(Arr.map(frames, (frame) => frame.walk), (walk) => walk >= 0)),
              washes: Arr.dedupe(
                Arr.filterMap(frames, (frame) =>
                  frame.wash.changes === "1" ? Option.some(frame.wash.opacity) : Option.none())
              ),
              settled
            }
          })
        const full = yield* finishing("no-preference")
        // The walk was seen part-drawn on its way to whole; the wash was seen fading and has settled to nothing.
        expect(Arr.some(full.walks, (walk) => walk > 0 && walk < 1), full.walks.join(" ")).toBe(true)
        expect(Arr.last(full.walks)).toEqual(Option.some(1))
        expect(Arr.some(full.washes, (opacity) => opacity > 0 && opacity < 1), full.washes.join(" ")).toBe(true)
        expect(full.settled).toEqual({ walk: 1, wash: { changes: "1", opacity: 0 } })
        const reduced = yield* finishing("reduce")
        // Drawn whole from its first frame; the wash, colour alone, still marks the change and settles.
        expect(reduced.walks).toEqual([1])
        expect(reduced.settled).toEqual({ walk: 1, wash: { changes: "1", opacity: 0 } })
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
        // Shrinks to 320 first, then grows: the stage must follow the column both ways. Below `lg` the column
        // is the page's reading width and the stage takes it whole; at `lg` the column is the grid's second
        // track, narrower than the reading width just below `lg`, and the stage is recut to it.
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

    it.scoped("every mark answers, and the answer lights what made it", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* goto(page, "/")
        yield* visible(rendered(page))
        const demo = page.getByRole("region", { name: "Imagined place demo" })
        const overlay = page.locator("[data-place-provenance]")

        // Every mark on the page, pointed at, names the package whose call made it.
        const marks = demo.locator("[data-provenance]")
        const total = yield* act(() => marks.count())
        expect(total).toBeGreaterThan(0)
        const pointable = yield* Effect.filter(Arr.range(0, total - 1), (index) =>
          act(() => marks.nth(index).isVisible()))
        expect(pointable.length).toBeGreaterThan(0)
        yield* Effect.forEach(pointable, (index) =>
          Effect.gen(function*() {
            const mark = marks.nth(index)
            yield* act(() =>
              mark.scrollIntoViewIfNeeded()
            )
            yield* hover(mark)
            yield* visible(overlay)
            yield* attribute(overlay.locator("a[href^='/docs/']").first(), "href", /^\/docs\/[a-z-]+$/u)
          }))

        // A code line pointed at is lit, and so is every disc it made.
        const composeLine = page.locator("[data-place-code-step='compose'] [data-code-annotation]").first()
        yield* act(() => composeLine.scrollIntoViewIfNeeded())
        yield* hover(composeLine)
        yield* visible(overlay)
        yield* count(page.locator("[data-code-line-focused]"), 1)
        yield* count(demo.locator("[data-place-marker][data-place-focused]"), 4)

        // The line itself is a mark, by its number in the gutter: the same answer as its value's, the same lighting.
        const composeGutter = page.locator("[data-place-code-step='compose'] [data-place-code-line]").first()
        yield* attribute(composeGutter, "data-place-code-site", "compose")
        yield* attribute(composeGutter, "aria-label", /^Line \d+$/u)
        yield* act(() => page.mouse.move(0, 0))
        yield* hidden(overlay)
        yield* hover(composeGutter)
        yield* visible(overlay)
        yield* containsText(overlay.locator("[data-current]").getByRole("heading", { level: 3 }), /\S/u)
        yield* count(page.locator("[data-code-line-focused]"), 1)
        yield* count(demo.locator("[data-place-marker][data-place-focused]"), 4)
        // Only the lines that made something are marks; the rest of the gutter is numbers.
        const gutterMarks = yield* act(() =>
          page.locator("[data-place-code-step='compose'] [data-place-code-line]").count()
        )
        expect(gutterMarks).toBe(2)

        // The line that digested the neighbor's proposal lights the one disc that proposal put on the paper.
        const built = page.locator("[data-place-how-its-built]")
        const propose = yield* Arr.findFirst(placeStepDefinitions, (step) => step.id === "propose")
        yield* click(built.getByRole("tab", { name: propose.name }))
        const digestLine = built.locator("[data-provenance*='proposal-digest'] [data-code-annotation]")
        yield* act(() => digestLine.scrollIntoViewIfNeeded())
        yield* act(() => page.mouse.move(0, 0))
        yield* hidden(overlay)
        yield* hover(digestLine)
        yield* visible(overlay)
        const neighborName = yield* Option.fromNullable(
          yield* act(() =>
            demo.locator("[data-place-proposal='neighbor'] [data-place-feature]").getAttribute("data-place-feature")
          )
        )
        yield* count(demo.locator("[data-place-marker][data-place-focused]"), 1)
        yield* attribute(demo.locator("[data-place-marker][data-place-focused]"), "data-place-marker", neighborName)

        // Each line of the arrangement answers with what it made, credited to its own package:
        // the first narrowed line from the layout, lit on the stage; the search's kept trial from
        // the call that scored it and from the call that recorded it, which light no line of prose.
        // Each site is two marks, the value beside the line and the line's number, and both answer alike.
        const arrange = yield* Arr.findFirst(placeStepDefinitions, (step) => step.id === "arrange")
        yield* click(built.getByRole("tab", { name: arrange.name }))
        // Between two answers the overlay holds both for a moment; the title asked about is the current one's.
        const title = overlay.locator("[data-current]").getByRole("heading", { level: 3 })
        const credited = overlay.locator("[data-current] a[href^='/docs/']").first()
        const litLines = demo.locator("[data-place-line][data-place-focused]")
        yield* Effect.forEach(
          [
            { site: "layout", title: /^Line \d+ of \d+$/u, href: "/docs/effect-text", lit: 1 },
            { site: "separation", title: /^Trial \d+ · kept$/u, href: "/docs/effect-math", lit: 0 },
            { site: "search", title: /^Trial \d+ · kept$/u, href: "/docs/effect-search", lit: 0 }
          ],
          (expected) =>
            Effect.gen(function*() {
              const marks = built.locator(`[data-provenance*='${expected.site}']`)
              yield* count(marks, 2)
              yield* Effect.forEach(
                [marks.locator("[data-code-annotation]"), marks.and(page.locator("[data-place-code-line]"))],
                (mark) =>
                  Effect.gen(function*() {
                    yield* act(() => mark.scrollIntoViewIfNeeded())
                    yield* act(() => page.mouse.move(0, 0))
                    yield* hidden(overlay)
                    yield* hover(mark)
                    yield* visible(overlay)
                    yield* containsText(title, expected.title)
                    yield* attribute(credited, "href", expected.href)
                    yield* count(page.locator("[data-code-line-focused]"), 1)
                    yield* count(litLines, expected.lit)
                  })
              )
            })
        )
        expect(yield* failures).toEqual([])
      }))

    /**
     * The answer's credited line is a route, not a hash: following it selects
     * the step whose code holds the line, closes the answer where it is, and
     * lands focus on the line's own gutter mark in the middle of the viewport.
     * By keyboard the landing shows its ring; under reduced motion it lands at
     * once rather than gliding.
     */
    it.scoped("an answer's credited line, followed by pointer, lands on that line of code", () =>
      Effect.gen(function*() {
        const { failures, landing, siteId } = yield* fromAnswerToItsCode("pointer", "no-preference")
        expect(landing).toMatchObject({ site: siteId, inViewport: true })
        expect(yield* failures).toEqual([])
      }))

    it.scoped("an answer's credited line, followed by keyboard, lands on that line with its focus ring", () =>
      Effect.gen(function*() {
        const { failures, landing, siteId } = yield* fromAnswerToItsCode("keyboard", "no-preference")
        expect(landing).toEqual({ site: siteId, focusVisible: true, inViewport: true })
        expect(yield* failures).toEqual([])
      }))

    it.scoped("under reduced motion the credited line is landed on at once", () =>
      Effect.gen(function*() {
        const { failures, landing, siteId } = yield* fromAnswerToItsCode("keyboard", "reduce")
        expect(landing).toEqual({ site: siteId, focusVisible: true, inViewport: true })
        expect(yield* failures).toEqual([])
      }))

    /**
     * On a phone the gutter is as much the line's mark as on a desk: the route
     * lands on it there too, and a line of the prose, credited to a step other
     * than the one open, lands with that step's code shown.
     */
    it.scoped("on a phone, a disc's credited line, followed by pointer, is landed on", () =>
      Effect.gen(function*() {
        const { failures, landing, siteId } = yield* fromAnswerToItsCode("pointer", "no-preference", "disc", phone)
        expect(landing).toMatchObject({ site: siteId, inViewport: true })
        expect(yield* failures).toEqual([])
      }))

    it.scoped("on a phone, a prose line's credited line, followed by keyboard, opens its own step and lands", () =>
      Effect.gen(function*() {
        const { failures, landing, siteId, step } = yield* fromAnswerToItsCode(
          "keyboard",
          "no-preference",
          "line",
          phone
        )
        expect(step).toBe("arrange")
        expect(landing).toEqual({ site: siteId, focusVisible: true, inViewport: true })
        expect(yield* failures).toEqual([])
      }))

    it.scoped("the lines answer from the keyboard, and a proposal lights the line its sentence stands on", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* goto(page, "/")
        yield* visible(rendered(page))
        const demo = page.getByRole("region", { name: "Imagined place demo" })
        const overlay = page.locator("[data-place-provenance]")
        const lines = demo.getByRole("toolbar", { name: "Lines of the prose" })
        const line = (index: number) => lines.locator(`[data-place-line='${String(index)}']`)

        // One stop in the tab order; the arrows move between lines; Enter answers the line under focus.
        yield* attribute(lines, "aria-orientation", "vertical")
        yield* attribute(line(0), "tabindex", "0")
        yield* attribute(line(1), "tabindex", "-1")
        yield* focus(line(0))
        yield* press(page, "ArrowDown")
        expect(yield* act(() => line(1).evaluate(isActiveElement))).toBe(true)
        yield* press(page, "Enter")
        yield* visible(overlay)
        yield* containsText(overlay.getByRole("heading", { level: 3 }), /^Line 2 of \d+$/u)
        yield* attribute(line(1), "data-place-focused", "")
        yield* press(page, "Escape")
        yield* hidden(overlay)
        // A pressed answer hands focus back to the mark that opened it.
        yield* eventually(() => line(1).evaluate(isActiveElement), true)

        // A merged proposal's name, pointed at, lights its disc and the line of the drawing its sentence stands on.
        const merged = demo.locator("[data-place-proposal][data-place-recorded='true']").first()
        const name = merged.locator("[data-place-feature]")
        const featureName = yield* act(() => name.innerText())
        yield* act(() => name.scrollIntoViewIfNeeded())
        yield* hover(name)
        yield* visible(overlay)
        yield* attribute(name, "data-place-focused", "")
        yield* count(demo.locator("[data-place-marker][data-place-focused]"), 1)
        yield* count(demo.locator("[data-place-line][data-place-focused]"), 1)
        const litLine = demo.locator("[data-place-line][data-place-focused]")
        const anchored = yield* Option.fromNullable(yield* act(() => litLine.getAttribute("data-place-line")))
        // The declined proposal's sentence is not in the prose: its name lights no line.
        const declined = demo.locator("[data-place-proposal][data-place-recorded='false']").first()
        yield* hover(declined.locator("[data-place-feature]"))
        yield* eventually(() => demo.locator("[data-place-line][data-place-focused]").count(), 0)

        // And the other way: that line, pointed at, lights the proposal's name and its disc, and says what it adds.
        yield* act(() => line(Number(anchored)).scrollIntoViewIfNeeded())
        yield* hover(line(Number(anchored)))
        yield* eventually(() => line(Number(anchored)).getAttribute("data-place-focused"), "")
        const current = overlay.locator("[data-current]")
        yield* containsText(current.getByRole("heading", { level: 3 }), `Line ${String(Number(anchored) + 1)} of `)
        yield* containsText(current, featureName)
        yield* attribute(name, "data-place-focused", "")
        yield* count(demo.locator("[data-place-feature][data-place-focused]"), 1)
        yield* count(demo.locator("[data-place-marker][data-place-focused]"), 1)
        // The line before it carries the composition's own words and lights no proposal. (The open
        // answer stands over that line, as a popup above its anchor does, so it is let go first.)
        yield* press(page, "Escape")
        yield* hidden(overlay)
        yield* hover(line(Number(anchored) - 1))
        yield* eventually(() => line(Number(anchored) - 1).getAttribute("data-place-focused"), "")
        yield* count(demo.locator("[data-place-feature][data-place-focused]"), 0)
        yield* count(demo.locator("[data-place-marker][data-place-focused]"), 0)
        expect(yield* failures).toEqual([])
      }))

    /**
     * The pointer's intent is the page's own: a mark's answer opens after its
     * delay from entry no matter what else leaves the page meanwhile, never
     * moves focus, and stays while the pointer is on the mark, its answer, or
     * a preview opened from it. These are the rules a shared hover timer in
     * the popover library broke, and the page no longer relies on one.
     */
    it.scoped("a mark leaving while the pointer rests on another does not cancel its answer", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* goto(page, "/")
        yield* visible(rendered(page))
        const demo = page.getByRole("region", { name: "Imagined place demo" })
        const overlay = page.locator("[data-place-provenance]")
        const built = page.locator("[data-place-how-its-built]")
        const compose = yield* Arr.findFirst(placeStepDefinitions, (step) => step.id === "compose")
        const composeTab = built.getByRole("tab", { name: compose.name })
        const composeMarks = built.locator("[data-place-code-step='compose'] [data-provenance]")

        // The code panel's tabs at the foot of the viewport, the prose above them on the stage.
        yield* act(() => composeTab.evaluate(scrollElementTo, 0.9))
        yield* focus(composeTab)
        yield* count(composeMarks, 4)
        const line = demo.locator("[data-place-line='5']")
        expect(yield* act(() => line.isVisible())).toBe(true)

        // The pointer comes to rest on a line; before its delay is up, the keyboard changes the tab
        // (the arrow moves, Enter activates), and every mark of the compose panel leaves the page.
        // The pointer has not moved.
        yield* hover(line)
        yield* press(page, "ArrowRight")
        yield* press(page, "Enter")
        yield* count(composeMarks, 0)
        yield* visible(overlay)
        yield* containsText(overlay.locator("[data-current]").getByRole("heading", { level: 3 }), /^Line 6 of \d+$/u)
        // Focus stayed with the keyboard, on the tab list.
        expect(yield* act(() => page.evaluate(activeElementRole))).toBe("tab")
        expect(yield* failures).toEqual([])
      }))

    it.scoped("a hover answer never takes focus; a press pins it until it is dismissed", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* goto(page, "/")
        yield* visible(rendered(page))
        const demo = page.getByRole("region", { name: "Imagined place demo" })
        const overlay = page.locator("[data-place-provenance]")
        const disc = demo.locator("[data-place-marker]").first()
        const body = page.locator("body")

        yield* act(() => disc.scrollIntoViewIfNeeded())
        yield* hover(disc)
        yield* visible(overlay)
        expect(yield* act(() => body.evaluate(isActiveElement))).toBe(true)

        // Leaving the mark and its answer closes a hover answer after the grace.
        yield* act(() => page.mouse.move(0, 0))
        yield* hidden(overlay)

        // A press on the mark of a hover answer pins it: the pointer may leave and it stays.
        yield* hover(disc)
        yield* visible(overlay)
        yield* click(disc)
        yield* act(() => page.mouse.move(0, 0))
        yield* Effect.sleep(Duration.millis(600))
        yield* visible(overlay)
        yield* press(page, "Escape")
        yield* hidden(overlay)
        expect(yield* failures).toEqual([])
      }))

    it.scoped("an answer opened on the drawing survives the next story's build and closes with its drawing", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* goto(page, "/")
        yield* visible(rendered(page))
        const demo = page.getByRole("region", { name: "Imagined place demo" })
        const overlay = page.locator("[data-place-provenance]")
        const heading = overlay.locator("[data-current]").getByRole("heading", { level: 3 })
        const disc = demo.locator("[data-place-marker]").first()
        yield* click(disc)
        yield* visible(overlay)
        const title = yield* Option.fromNullable(yield* act(() => heading.textContent()))
        const scenarios = demo.getByRole("radiogroup", { name: "Scenario" })
        const radio = scenarios.getByRole("radio", { name: placeScenarioMeta["lost-market"].label })
        // The answer's title, sampled a frame apart for as long as the popup is on the page:
        // while the next story is built the old drawing stays and so does its answer; the
        // moment the new drawing replaces it the answer goes — fading with the words it had,
        // never emptied, and never having named another build's feature.
        const sampling = yield* Stream.repeatEffectWithSchedule(
          act(() => page.evaluate(answerPopupsShowing)),
          Schedule.spaced("16 millis").pipe(Schedule.upTo(Duration.seconds(12)))
        ).pipe(
          Stream.takeUntil(({ popups }) => popups === 0),
          Stream.runCollect,
          Effect.map(Chunk.toReadonlyArray),
          Effect.fork
        )
        yield* click(radio)
        const popupUntilGone = yield* Fiber.join(sampling)
        const whileOnPage = Arr.filter(popupUntilGone, ({ popups }) => popups > 0)
        expect(whileOnPage.length).toBeGreaterThan(0)
        expect(Arr.every(whileOnPage, ({ titles }) => titles.length === 1 && titles[0] === title)).toBe(true)
        yield* hidden(overlay)
        expect(yield* act(() => radio.evaluate(isActiveElement))).toBe(true)
        expect(yield* failures).toEqual([])
      }))

    it.scoped("the mark, its answer and a preview opened from it are one place for the pointer", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* goto(page, "/")
        yield* visible(rendered(page))
        const demo = page.getByRole("region", { name: "Imagined place demo" })
        const overlay = page.locator("[data-place-provenance]")
        const line = demo.locator("[data-place-line='2']")

        // From the mark into its answer: still here, well past the grace.
        yield* act(() => line.scrollIntoViewIfNeeded())
        yield* hover(line)
        yield* visible(overlay)
        yield* hover(overlay)
        yield* Effect.sleep(Duration.millis(600))
        yield* visible(overlay)

        // From the answer into a preview opened from inside it: still here.
        yield* click(overlay.locator("a[href^='/docs/']").first())
        const preview = page.locator("[data-docs-link-preview]")
        yield* visible(preview)
        yield* hover(preview)
        yield* Effect.sleep(Duration.millis(600))
        yield* visible(overlay)

        // Leaving all of it closes all of it: the answer after its grace, and the preview with it.
        yield* act(() => page.mouse.move(0, 0))
        yield* hidden(preview)
        yield* hidden(overlay)
        expect(yield* failures).toEqual([])
      }))

    it.scoped("the acts answer on the stage", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* goto(page, "/")
        yield* visible(rendered(page))
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
        yield* visible(rendered(page))
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
        yield* visible(rendered(page))
        yield* act(() => page.evaluate(scrollToTop))
        yield* attribute(stage, "data-place-stage-act", "arrive")
        yield* act(() => page.locator("[data-place-act='record']").evaluate(scrollElementTo, 0.45))
        yield* attribute(stage, "data-place-stage-act", "record")
        expect(yield* failures).toEqual([])
      }))

    /**
     * A switch's thumb travels by CSS transition, which Motion's configuration
     * does not reach: it takes its place at once under reduced motion by the
     * page's own rule, and eases across otherwise.
     */
    it.scoped("a switch's thumb eases across, and under reduced motion takes its place at once", () =>
      Effect.gen(function*() {
        const thumbTransition = (reducedMotion: ReducedMotion) =>
          Effect.gen(function*() {
            const { failures, page } = yield* openPage({ reducedMotion })
            yield* goto(page, "/")
            yield* visible(rendered(page))
            const demo = page.getByRole("region", { name: "Imagined place demo" })
            const thumb = demo.getByRole("switch").first().locator("span").first()
            yield* visible(thumb)
            const transition = yield* act(() => thumb.evaluate(transitionOf))
            expect(yield* failures).toEqual([])
            return transition
          })
        expect(yield* thumbTransition("no-preference")).toEqual({
          property: "transform, translate, scale, rotate",
          duration: "0.15s"
        })
        expect(yield* thumbTransition("reduce")).toMatchObject({ property: "none" })
      }))

    it.scoped("under reduced motion the band places its discs where they stand; nothing slides", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ reducedMotion: "reduce", viewport: { width: 390, height: 844 } })
        yield* goto(page, "/")
        yield* visible(rendered(page))
        const demo = page.getByRole("region", { name: "Imagined place demo" })
        const band = page.locator("[data-place-band]")
        const proposal = demo.locator("[data-place-proposal='program']")
        const feature = proposal.locator("[data-place-feature]")
        const name = yield* Option.fromNullable(yield* act(() => feature.getAttribute("data-place-feature")))
        yield* act(() => proposal.scrollIntoViewIfNeeded())
        yield* visible(band)

        // The program's feature merged, its disc stands last in the row, after the neighbor's.
        const merge = yield* Effect.fork(nextResponse(page, "POST", "/api/imagined-place/build"))
        yield* click(proposal.getByRole("switch"))
        expect((yield* Fiber.join(merge)).status()).toBe(200)
        yield* eventually(() => band.evaluate(bandShowsKept, name), true)
        const before = yield* act(() => band.evaluate(bandDiscCentre, name))

        // Declining the neighbor takes a disc out from before it, so the program's disc has to move left.
        // Every centre it is drawn at, sampled a frame apart, from the decline until the neighbor's disc
        // has left the band and the drawing is the kept one again.
        const neighbor = demo.locator("[data-place-proposal='neighbor']")
        const neighborName = yield* Option.fromNullable(
          yield* act(() => neighbor.locator("[data-place-feature]").getAttribute("data-place-feature"))
        )
        const landed = Effect.map(
          Effect.all([
            act(() => band.evaluate(bandDiscCentre, neighborName)),
            act(() => band.evaluate(bandShowsKept, name))
          ]),
          ([neighborCentre, kept]) => neighborCentre === "" && kept
        )
        const decline = yield* Effect.fork(nextResponse(page, "POST", "/api/imagined-place/build"))
        yield* click(neighbor.getByRole("switch"))
        const drawn = yield* Effect.fork(
          Stream.repeatEffectWithSchedule(
            act(() => band.evaluate(bandDiscCentre, name)),
            Schedule.spaced("16 millis").pipe(Schedule.upTo(Duration.seconds(12)))
          ).pipe(
            Stream.takeUntilEffect(() => landed),
            Stream.runCollect,
            Effect.map(Chunk.toReadonlyArray)
          )
        )
        expect((yield* Fiber.join(decline)).status()).toBe(200)
        const centres = Arr.dedupe(yield* Fiber.join(drawn))
        const after = yield* act(() => band.evaluate(bandDiscCentre, name))
        // The disc did move, and every place it was drawn at is one the row stands at: none between the two.
        expect(Number(after)).toBeLessThan(Number(before))
        expect(Arr.difference(centres, [before, after])).toEqual([])
        expect(yield* failures).toEqual([])
      }))

    it.scoped("choosing another story changes the drawing and nothing of the page, in every mode", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* goto(page, "/")
        yield* visible(rendered(page))
        const demo = page.getByRole("region", { name: "Imagined place demo" })
        const scenarios = demo.getByRole("radiogroup", { name: "Scenario" })
        const brief = demo.getByRole("textbox", { name: "Brief" })
        const paper = page.locator("[data-place-stage='paper']")
        const title = page.locator("h1")
        // The story is taken once its own brief is in the field and the stage draws its features, kept.
        const storyTaken = (scenario: PlaceScenario) =>
          Effect.andThen(
            eventually(() => brief.inputValue(), placeScenarioMeta[scenario].brief),
            eventually(() => demo.evaluate(storyDrawn), true)
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
        yield* visible(rendered(page))
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
        yield* visible(rendered(page))
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
