// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import { Chunk, Duration, Effect, Fiber, Layer, Option, Schedule, Stream } from "effect"
import * as Arr from "effect/Array"

import { renderTrials } from "../../app/contracts/demo/imagined-place-search.js"
import { placeStepDefinitions } from "../../app/web/view/home/placeSteps.js"
import type { ReducedMotion } from "./browser.js"
import {
  act,
  animationsSettled,
  attribute,
  BrowserLive,
  click,
  containsText,
  count,
  eventually,
  focus,
  goto,
  hidden,
  hover,
  nextResponse,
  openPage,
  press,
  until,
  visible
} from "./browser.js"
import {
  bandDiscCentre,
  bandShowsKept,
  discsAtRest,
  finishingTouches,
  scrollAffordance,
  stageLayout,
  textFitsItsBox,
  transitionOf
} from "./platform/in-page.js"
import { SiteLive } from "./site.js"

import {
  changeStory,
  markerPositions,
  mergeProgramProposal,
  paperUntilLanding,
  recordPaper,
  rendered,
  stageFailuresUntilRendered
} from "./demo.js"

layer(Layer.merge(SiteLive, BrowserLive), { excludeTestServices: true, timeout: "3 minutes" })(
  "Theoria home page demo in Chromium: the search and its drawing",
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
  }
)
