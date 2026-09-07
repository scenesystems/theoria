import { Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Duration, Effect, Fiber, Option, Queue, Ref, Stream, TestClock } from "effect"
import * as Chunk from "effect/Chunk"

import {
  type HoverIntent,
  PlaceAnswer,
  type PlaceMark,
  type PointerOver
} from "../../app/contracts/demo/imagined-place-provenance.js"
import { answerCloseGrace, answerOpenDelay } from "../../app/contracts/motion.js"
import {
  answerAfterIntent,
  answerAfterPress,
  hoverIntents,
  placeAnswerAtom,
  placeAnswerOpeningAtom,
  placeFocusAtom
} from "../../app/web/atoms/imagined-place-experience.js"

/**
 * The pointer's intent is owned here, not by the popover library: entering a
 * mark starts that mark's delay, leaving starts the close grace, and only the
 * latest position counts. These are the timings the page keeps, on a test
 * clock, and the rule for what an intent does to the open answer.
 */

const line: PlaceMark = { _tag: "Line", index: 3 }
const disc: PlaceMark = { _tag: "Feature", name: "the iron stair" }

const overMark = (triggerId: string, mark: PlaceMark): Option.Option<PointerOver> =>
  Option.some({ _tag: "Mark", triggerId, mark })
const overAnswer: Option.Option<PointerOver> = Option.some({ _tag: "Answer" })
const overNothing: Option.Option<PointerOver> = Option.none()

/** A pointer whose positions are offered one at a time, and every intent decided so far. */
const pointer = Effect.gen(function*() {
  const positions = yield* Queue.unbounded<Option.Option<PointerOver>>()
  const decided = yield* Ref.make(Chunk.empty<HoverIntent>())
  const process = yield* Effect.fork(
    hoverIntents(Stream.fromQueue(positions)).pipe(
      Stream.runForEach((intent) => Ref.update(decided, Chunk.append(intent)))
    )
  )
  // Let the process subscribe before the clock moves.
  yield* TestClock.adjust("0 millis")
  const moveTo = (position: Option.Option<PointerOver>) =>
    Queue.offer(positions, position).pipe(Effect.zipRight(TestClock.adjust("0 millis")))
  const intents = Effect.map(Ref.get(decided), Chunk.toReadonlyArray)
  return { intents, moveTo, process }
})

const openOf = (triggerId: string, mark: PlaceMark): HoverIntent => ({ _tag: "Open", triggerId, mark })
const close: HoverIntent = { _tag: "Close" }

describe("hover intent", () => {
  it.effect("a line answers only after its full delay", () =>
    Effect.gen(function*() {
      const { intents, moveTo, process } = yield* pointer
      yield* moveTo(overMark("a", line))
      yield* TestClock.adjust("319 millis")
      expect(yield* intents).toEqual([])
      yield* TestClock.adjust("1 millis")
      expect(yield* intents).toEqual([openOf("a", line)])
      yield* Fiber.interrupt(process)
    }))

  it.effect("moving to a second mark forgets the first and waits the second's delay from entry", () =>
    Effect.gen(function*() {
      const { intents, moveTo, process } = yield* pointer
      yield* moveTo(overMark("a", line))
      yield* TestClock.adjust("100 millis")
      yield* moveTo(overMark("b", disc))
      yield* TestClock.adjust("119 millis")
      expect(yield* intents).toEqual([])
      yield* TestClock.adjust("1 millis")
      expect(yield* intents).toEqual([openOf("b", disc)])
      yield* TestClock.adjust("1 second")
      expect(yield* intents).toEqual([openOf("b", disc)])
      yield* Fiber.interrupt(process)
    }))

  it.effect("leaving before the delay opens nothing and closes after the grace", () =>
    Effect.gen(function*() {
      const { intents, moveTo, process } = yield* pointer
      yield* moveTo(overMark("a", line))
      yield* TestClock.adjust("100 millis")
      yield* moveTo(overNothing)
      yield* TestClock.adjust("149 millis")
      expect(yield* intents).toEqual([])
      yield* TestClock.adjust("1 millis")
      expect(yield* intents).toEqual([close])
      yield* Fiber.interrupt(process)
    }))

  it.effect("crossing into the answer within the grace keeps it; leaving the answer closes after the grace", () =>
    Effect.gen(function*() {
      const { intents, moveTo, process } = yield* pointer
      yield* moveTo(overMark("a", disc))
      yield* TestClock.adjust("120 millis")
      yield* moveTo(overNothing)
      yield* TestClock.adjust("100 millis")
      yield* moveTo(overAnswer)
      yield* TestClock.adjust("1 second")
      expect(yield* intents).toEqual([openOf("a", disc)])
      yield* moveTo(overNothing)
      yield* TestClock.adjust("150 millis")
      expect(yield* intents).toEqual([openOf("a", disc), close])
      yield* Fiber.interrupt(process)
    }))

  it.effect("the delays are the motion tokens", () =>
    Effect.sync(() => {
      expect(answerOpenDelay(line)).toEqual(Duration.millis(320))
      expect(answerOpenDelay(disc)).toEqual(Duration.millis(120))
      expect(answerCloseGrace).toEqual(Duration.millis(150))
    }))
})

describe("the answer under an intent", () => {
  const hoverOpened = new PlaceAnswer({ triggerId: "a", mark: disc, opening: "hover" })
  const pressOpened = new PlaceAnswer({ triggerId: "a", mark: disc, opening: "press" })

  it.effect("an open intent answers the mark as a hover", () =>
    Effect.sync(() => {
      expect(answerAfterIntent(Option.none(), openOf("b", line))).toEqual(
        Option.some(new PlaceAnswer({ triggerId: "b", mark: line, opening: "hover" }))
      )
      expect(answerAfterIntent(Option.some(pressOpened), openOf("b", line))).toEqual(
        Option.some(new PlaceAnswer({ triggerId: "b", mark: line, opening: "hover" }))
      )
    }))

  it.effect("a close intent closes a hover answer and leaves a pressed one pinned", () =>
    Effect.sync(() => {
      expect(answerAfterIntent(Option.some(hoverOpened), close)).toEqual(Option.none())
      expect(answerAfterIntent(Option.some(pressOpened), close)).toEqual(Option.some(pressOpened))
      expect(answerAfterIntent(Option.none(), close)).toEqual(Option.none())
    }))

  it.effect("a press opens a mark's answer pinned; the same mark pressed again closes it", () =>
    Effect.sync(() => {
      const pressA = { triggerId: "a", mark: disc }
      expect(answerAfterPress(Option.none(), { opening: true, pressed: pressA })).toEqual({
        _tag: "Answer",
        answer: Option.some(pressOpened)
      })
      expect(answerAfterPress(Option.some(pressOpened), { opening: false, pressed: pressA })).toEqual({
        _tag: "Answer",
        answer: Option.none()
      })
    }))

  it.effect("pressing the mark of a hover answer pins it instead of closing it", () =>
    Effect.sync(() => {
      expect(answerAfterPress(Option.some(hoverOpened), { opening: false, pressed: { triggerId: "a", mark: disc } }))
        .toEqual({ _tag: "Pin", answer: pressOpened })
    }))

  it.effect("pressing an answering digest changes nothing about the answer", () =>
    Effect.sync(() => {
      const digest: PlaceMark = { _tag: "Digest", contentId: "th_1abc" }
      const digestAnswer = new PlaceAnswer({ triggerId: "d", mark: digest, opening: "hover" })
      expect(answerAfterPress(Option.some(digestAnswer), { opening: false, pressed: { triggerId: "d", mark: digest } }))
        .toEqual({ _tag: "Leave" })
      // From closed, a digest press opens as any press does.
      expect(answerAfterPress(Option.none(), { opening: true, pressed: { triggerId: "d", mark: digest } })).toEqual({
        _tag: "Answer",
        answer: Option.some(new PlaceAnswer({ triggerId: "d", mark: digest, opening: "press" }))
      })
    }))

  it.effect("how the answer on show was opened outlives the answer, for the popup's leaving", () =>
    Effect.sync(() => {
      const registry = Registry.make({
        scheduleTask: (task) => {
          task()
        }
      })
      expect(registry.get(placeAnswerOpeningAtom)).toBe("press")
      registry.set(placeAnswerAtom, Option.some(hoverOpened))
      expect(registry.get(placeAnswerOpeningAtom)).toBe("hover")
      registry.set(placeAnswerAtom, Option.none())
      expect(registry.get(placeAnswerOpeningAtom)).toBe("hover")
      registry.set(placeAnswerAtom, Option.some(pressOpened))
      registry.set(placeAnswerAtom, Option.none())
      expect(registry.get(placeAnswerOpeningAtom)).toBe("press")
    }))

  it.effect("focus is the open answer's mark", () =>
    Effect.sync(() => {
      const registry = Registry.make({
        scheduleTask: (task) => {
          task()
        }
      })
      expect(registry.get(placeFocusAtom)).toEqual(Option.none())
      registry.set(placeAnswerAtom, Option.some(hoverOpened))
      expect(registry.get(placeFocusAtom)).toEqual(Option.some(disc))
      registry.set(placeAnswerAtom, Option.none())
      expect(registry.get(placeFocusAtom)).toEqual(Option.none())
    }))
})
