import { expect } from "@effect/vitest"
import { Effect, Option } from "effect"
import * as Arr from "effect/Array"

import { PlaceAnswer, type PlaceMark, placeSourceId } from "../../app/contracts/demo/imagined-place-provenance.js"
import {
  answerAfterPress,
  placeAnswerAtom,
  placeAnswerFocusReturnAtom,
  placeAnswerOnShowAtom,
  placeFocusAtom,
  placeMarkLeftAtom
} from "../../app/web/atoms/imagined-place-experience.js"
import { describeOnStage, onStage, pageShowing } from "../helpers/place-on-stage.js"

/**
 * A mark answers when it is pressed, and only then: there is no pointer
 * intent, no delay and no grace. The press is what the popover reports —
 * which mark, and whether the popover would open or close for it — and the
 * answer is what that press says. Every answer takes focus and hands it back
 * to its mark; only an answer whose mark left the page lets focus stay.
 */

const line: PlaceMark = { _tag: "Line", index: 3, drawing: { source: "blake3-256:test", stageWidth: 660 } }
const disc: PlaceMark = { _tag: "Feature", name: "the iron stair" }
const digest: PlaceMark = { _tag: "Digest", contentId: "th_1abc" }

describeOnStage("the answer under a press", (it) => {
  const onDisc = new PlaceAnswer({ triggerId: "a", mark: disc })

  it.effect("a press opens the pressed mark's answer; the same mark pressed again closes it", () =>
    Effect.sync(() => {
      const pressA = { triggerId: "a", mark: disc }
      expect(answerAfterPress({ opening: true, pressed: pressA })).toEqual(Option.some(onDisc))
      expect(answerAfterPress({ opening: false, pressed: pressA })).toEqual(Option.none())
    }))

  it.effect("another mark pressed while one answers is answered instead, from its own trigger", () =>
    Effect.sync(() => {
      expect(answerAfterPress({ opening: true, pressed: { triggerId: "b", mark: line } })).toEqual(
        Option.some(new PlaceAnswer({ triggerId: "b", mark: line }))
      )
      // The same mark carried by a second trigger answers from that trigger, so the popup stands over it.
      expect(answerAfterPress({ opening: true, pressed: { triggerId: "a2", mark: disc } })).toEqual(
        Option.some(new PlaceAnswer({ triggerId: "a2", mark: disc }))
      )
    }))

  it.effect("a digest pressed answers like any other mark; copying is the answer's own control", () =>
    Effect.sync(() => {
      expect(answerAfterPress({ opening: true, pressed: { triggerId: "d", mark: digest } })).toEqual(
        Option.some(new PlaceAnswer({ triggerId: "d", mark: digest }))
      )
      expect(answerAfterPress({ opening: false, pressed: { triggerId: "d", mark: digest } })).toEqual(Option.none())
    }))

  it.effect("an answer hands focus back to its mark when it closes", () =>
    Effect.gen(function*() {
      const { build, showingTrial } = yield* onStage
      const registry = pageShowing(build, showingTrial)
      expect(registry.get(placeAnswerFocusReturnAtom)).toBe("mark")
      registry.set(placeAnswerAtom, Option.some(onDisc))
      expect(registry.get(placeAnswerFocusReturnAtom)).toBe("mark")
      registry.set(placeAnswerAtom, Option.none())
      expect(registry.get(placeAnswerFocusReturnAtom)).toBe("mark")
    }))

  it.effect("focus is the open answer's mark", () =>
    Effect.gen(function*() {
      const { build, showingTrial } = yield* onStage
      const available: PlaceMark = {
        _tag: "Feature",
        name: (yield* Arr.head(build.artifact.composition.features)).name
      }
      const registry = pageShowing(build, showingTrial)
      expect(registry.get(placeFocusAtom)).toEqual(Option.none())
      registry.set(placeAnswerAtom, Option.some(new PlaceAnswer({ triggerId: "a", mark: available })))
      expect(registry.get(placeFocusAtom)).toEqual(Option.some(available))
      registry.set(placeAnswerAtom, Option.none())
      expect(registry.get(placeFocusAtom)).toEqual(Option.none())
    }))
})

describeOnStage("answer lifetime", (it) => {
  it.effect("an answer opened on the drawing outlives the next build, and is gone once its drawing is replaced", () =>
    Effect.gen(function*() {
      const { build, other, showingTrial, trial } = yield* onStage
      const name = (yield* Arr.head(trial.projection.markers)).name
      const onDisc = new PlaceAnswer({
        triggerId: "d",
        mark: { _tag: "Disc", name, source: placeSourceId(build) }
      })

      // The column already describes the next story; the paper still draws this one.
      const stillDrawn = pageShowing(other.build, showingTrial)
      stillDrawn.set(placeAnswerAtom, Option.some(onDisc))
      expect(Option.map(stillDrawn.get(placeAnswerAtom), (answer) => answer.mark)).toEqual(Option.some(onDisc.mark))
      expect(stillDrawn.get(placeAnswerFocusReturnAtom)).toBe("mark")

      // The paper now draws the next story: the disc pointed at is no longer on the page.
      const replaced = pageShowing(other.build, other.showing)
      replaced.set(placeAnswerAtom, Option.some(onDisc))
      expect(replaced.get(placeAnswerAtom)).toEqual(Option.none())
    }))

  it.effect("the popup keeps the answer's words while it leaves", () =>
    Effect.gen(function*() {
      const { build, showingTrial, trial } = yield* onStage
      const name = (yield* Arr.head(trial.projection.markers)).name
      const registry = pageShowing(build, showingTrial)
      expect(registry.get(placeAnswerOnShowAtom)).toEqual(Option.none())

      registry.set(
        placeAnswerAtom,
        Option.some(new PlaceAnswer({ triggerId: "d", mark: { _tag: "Disc", name, source: placeSourceId(build) } }))
      )
      const shown = registry.get(placeAnswerOnShowAtom)
      expect(Option.map(shown, (provenance) => provenance.title)).toEqual(Option.some(name))

      // Closed: nothing is answered, yet the popup still has what it was saying to fade with —
      // through the popover's own dismissal closing it again while nothing is answered.
      registry.set(placeAnswerAtom, Option.none())
      registry.set(placeAnswerAtom, Option.none())
      expect(registry.get(placeAnswerAtom)).toEqual(Option.none())
      expect(registry.get(placeAnswerOnShowAtom)).toEqual(shown)
    }))

  it.effect("the mark leaving the page takes its answer with it: closed with its words, and focus stays", () =>
    Effect.gen(function*() {
      // A declined proposal's ghost stands at the margin only while the proposing act is read; its feature
      // is still in the build, so the page could answer for it — but the mark that opened the answer is gone.
      const { build, showingTrial } = yield* onStage
      const declined = yield* Arr.findFirst(build.proposals, (record) => !record.accepted)
      const ghost = new PlaceAnswer({
        triggerId: "ghost",
        mark: { _tag: "Feature", name: declined.proposal.feature.name }
      })
      const registry = pageShowing(build, showingTrial)
      // Every mark holds the leaving mounted, as `useAtomSet` does.
      registry.mount(placeMarkLeftAtom)
      registry.set(placeAnswerAtom, Option.some(ghost))
      const shown = registry.get(placeAnswerOnShowAtom)
      expect(Option.isSome(shown)).toBe(true)

      // Another mark leaving is not this answer's concern.
      registry.set(placeMarkLeftAtom, "another")
      expect(registry.get(placeAnswerAtom)).toEqual(Option.some(ghost))
      expect(registry.get(placeAnswerFocusReturnAtom)).toBe("mark")

      registry.set(placeMarkLeftAtom, "ghost")
      expect(registry.get(placeAnswerAtom)).toEqual(Option.none())
      expect(registry.get(placeAnswerOnShowAtom)).toEqual(shown)
      expect(registry.get(placeAnswerFocusReturnAtom)).toBe("stays")

      // The mark back on the page — the proposing act read again — answers from the same id, and its
      // answer stands: the leaving was one event, not a standing rule about that id.
      registry.set(placeAnswerAtom, Option.some(ghost))
      expect(registry.get(placeAnswerAtom)).toEqual(Option.some(ghost))
      expect(registry.get(placeAnswerFocusReturnAtom)).toBe("mark")

      // A mark leaving once nothing is answered — the popup's own exit, say — changes nothing.
      registry.set(placeAnswerAtom, Option.none())
      expect(registry.get(placeAnswerFocusReturnAtom)).toBe("mark")
      registry.set(placeMarkLeftAtom, "ghost")
      expect(registry.get(placeAnswerFocusReturnAtom)).toBe("mark")
    }))
})
