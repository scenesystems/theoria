/** Shared fixtures for the home-page demo’s Chromium tests. */
import { expect } from "@effect/vitest"
import type { Locator, Page } from "@playwright/test"
import { Chunk, Duration, Effect, Fiber, Match, Option, Order, Schedule, Schema, Stream } from "effect"
import * as Arr from "effect/Array"

import { codeSite, CodeSiteId } from "../../app/contracts/demo/imagined-place-provenance.js"
import { placeStepDefinitions } from "../../app/web/view/home/placeSteps.js"
import type { ColorScheme, ReducedMotion, Viewport } from "./browser.js"
import {
  act,
  attribute,
  click,
  count,
  desktop,
  eventually,
  focus,
  goto,
  hidden,
  nextResponse,
  openPage,
  press,
  until,
  urlMatches,
  visible
} from "./browser.js"
import {
  focusLanding,
  isActiveElement,
  leaversGone,
  markerPositionsInStage,
  recordedPaperFrames,
  recordPaperFrames,
  stageFrame,
  storyDrawn
} from "./platform/in-page.js"

export const rendered = (page: Page) => page.locator("[data-place-render-phase='complete']")

/** Both modes the page is read in. */
export const colorSchemes: ReadonlyArray<ColorScheme> = ["light", "dark"]

/**
 * How many failures the stage tells (`StageFailed`, the search caption's row
 * when the build or the drawing failed), sampled a frame apart from now until
 * the place is drawn. A build still on its way is waiting, not failed, so
 * before the first frame there is nothing to report.
 */
export const stageFailuresUntilRendered = (page: Page) =>
  Stream.repeatEffectWithSchedule(
    act(() => page.locator("[data-place-stage-failed]").count()),
    Schedule.spaced("16 millis")
  ).pipe(
    Stream.interruptWhen(visible(rendered(page))),
    Stream.runCollect,
    Effect.map(Chunk.toReadonlyArray)
  )

/** One sample of the paper: its reported height, if there is a paper, and the search's phase, if a trial is in. */
export const PaperSample = Schema.Struct({
  height: Schema.Option(Schema.String),
  phase: Schema.Option(Schema.String)
})
export type PaperSample = typeof PaperSample.Type

export const paperSample = (reported: string): PaperSample => {
  const [height = "-", phase = "-"] = reported.split(" ")
  return PaperSample.make({
    height: height === "-" ? Option.none() : Option.some(height),
    phase: phase === "-" ? Option.none() : Option.some(phase)
  })
}

export const landing = (sample: PaperSample): boolean =>
  Option.exists(sample.phase, (phase) => phase === "landing" || phase === "complete")

/** Records the paper on every animation frame of every document the page loads from now on. */
export const recordPaper = (page: Page) => act(() => page.addInitScript(recordPaperFrames))

/**
 * Every change to the paper recorded from the document's first frame until
 * the search lands its drawing. Before the first trial is in, the paper is the
 * one the search is expected to want; while the trials run, the first frame
 * holds it; so every height until landing is one height.
 */
export const paperUntilLanding = (page: Page) =>
  Effect.map(
    act(() => page.evaluate(recordedPaperFrames)),
    (recorded) => Arr.takeWhile(Arr.map(recorded.split("\n"), paperSample), (sample) => !landing(sample))
  )

/** Every disc's position relative to the stage, so scrolling cannot move it. */
export const markerPositions = (page: Page) => () =>
  page.locator("[data-place-marker]").evaluateAll(markerPositionsInStage)

export const FeaturePlace = Schema.Struct({
  name: Schema.String,
  kind: Schema.Literal("ring", "disc"),
  translate: Schema.String,
  transform: Schema.String
})
export type FeaturePlace = typeof FeaturePlace.Type

/** A set of prose lines standing on the stage: the text it sets, and whether it is painted at all. */
export const LineSet = Schema.Struct({
  text: Schema.String,
  painted: Schema.Boolean
})

/**
 * One frame of the stage while its drawing changes: where every feature is
 * painted, which sets of lines stand, and any line of prose painted over a disc.
 */
export const StageFrame = Schema.Struct({
  phase: Schema.String,
  places: Schema.Array(FeaturePlace),
  lines: Schema.Array(LineSet),
  overlaps: Schema.Array(Schema.String)
})
export type StageFrame = typeof StageFrame.Type

/** The frame's places of one feature. */
export const placesIn = (frame: StageFrame, name: string): ReadonlyArray<FeaturePlace> =>
  Arr.filter(frame.places, (place) => place.name === name)

/** The feature `name` has a disc filled in and at rest in the frame. */
export const landed = (name: string) => (frame: StageFrame): boolean =>
  Arr.some(placesIn(frame, name), (place) => place.kind === "disc" && place.transform === "none")

/**
 * The stage sampled a frame apart from now until `done` holds of a frame —
 * that frame included — or for `atMost`.
 */
export const framesUntil = (region: Locator, done: (frame: StageFrame) => boolean, atMost: Duration.Duration) =>
  Stream.repeatEffectWithSchedule(
    act(() => region.evaluate(stageFrame)),
    Schedule.spaced("16 millis").pipe(Schedule.upTo(atMost))
  ).pipe(
    Stream.takeUntil(done),
    Stream.runCollect,
    Effect.map(Chunk.toReadonlyArray)
  )

/** Every distinct `translate` the feature's `kind` was painted at, in order of first sight. */
export const placesOf = (
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
export const mergeProgramProposal = (reducedMotion: ReducedMotion) =>
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
export const drawingStands = (frame: StageFrame): string =>
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
export const paintedSets = (frame: StageFrame): ReadonlyArray<string> =>
  Arr.filterMap(frame.lines, (set) => set.painted ? Option.some(set.text) : Option.none())

/** A set of lines other than those in `known` is painted in the frame. */
export const paintsNewSet = (frame: StageFrame, known: ReadonlyArray<string>): boolean =>
  Arr.some(paintedSets(frame), (text) => !Arr.contains(known, text))

/**
 * Changes the story and reports every frame painted inside the demo until the
 * new drawing is kept and landed. The lines set from the old story leave
 * before anything moves, and the discs wait for the new lines to stand: the
 * first frame in which any disc is drawn elsewhere than it stood is no
 * earlier than the first frame in which the new set is painted, and at no
 * frame is a line of prose painted over a disc.
 */
export const changeStory = () =>
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
export const fromAnswerToItsCode = (
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

export const referenceTargets = (references: Locator) =>
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
