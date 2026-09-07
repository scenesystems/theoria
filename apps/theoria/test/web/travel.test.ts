import { describe, expect, it } from "@effect/vitest"
import { Chunk, Duration, Effect, Option, Ref, Stream, TestClock } from "effect"
import * as Arr from "effect/Array"

import { follow, journeyFrom, toward, Travelling } from "../../app/web/motion/travel.js"

/** A number travels by moving straight; a frame is the test clock moving on 16 ms. */
const travelling = new Travelling<number>({
  between: (from, to, t) => from + (to - from) * t,
  duration: Duration.millis(160),
  ticks: Stream.repeatEffect(TestClock.adjust("16 millis"))
})

const placedOutright = new Travelling<number>({ ...travelling, duration: Duration.zero })

const collect = <A>(stream: Stream.Stream<A>) => Effect.map(Stream.runCollect(stream), Chunk.toReadonlyArray)

const isMonotone = (values: ReadonlyArray<number>): boolean =>
  Arr.every(Arr.zip(values, Arr.drop(values, 1)), ([earlier, later]) => later >= earlier)

describe("travel", () => {
  it.effect("the first target ever is placed outright", () =>
    Effect.gen(function*() {
      const journey = yield* journeyFrom(Option.none<number>())
      expect(yield* collect(toward(travelling, journey, 10))).toEqual([10])
    }))

  it.effect("a travel begins where the drawing was, moves every frame and lands on the target itself", () =>
    Effect.gen(function*() {
      const journey = yield* journeyFrom(Option.some(0))
      const drawn = yield* collect(toward(travelling, journey, 100))
      expect(Arr.head(drawn)).toEqual(Option.some(0))
      expect(Arr.last(drawn)).toEqual(Option.some(100))
      // Where the drawing is at once, then the frame that begins the travel, then ten frames of 16 ms.
      expect(drawn.length).toBe(12)
      expect(isMonotone(drawn)).toBe(true)
    }))

  it.effect("the travel begins with the first frame drawn, not when the target is set", () =>
    Effect.gen(function*() {
      const journey = yield* journeyFrom(Option.some(0))
      const stream = toward(travelling, journey, 100)
      // The page is busy for a while between the target being set and the first frame.
      yield* TestClock.adjust("1 second")
      const drawn = yield* collect(stream)
      expect(Arr.take(drawn, 2)).toEqual([0, 0])
      expect(drawn.length).toBe(12)
    }))

  it.effect("the same target set again continues the travel under way", () =>
    Effect.gen(function*() {
      const journey = yield* journeyFrom(Option.some(0))
      const partWay = yield* collect(Stream.take(toward(travelling, journey, 100), 5))
      const rest = yield* collect(toward(travelling, journey, 100))
      expect(Arr.last(partWay)).toEqual(Arr.head(rest))
      expect(rest.length).toBeLessThan(12)
      expect(Arr.last(rest)).toEqual(Option.some(100))
    }))

  it.effect("a new target starts from wherever the drawing is at that moment", () =>
    Effect.gen(function*() {
      const journey = yield* journeyFrom(Option.some(0))
      const partWay = yield* collect(Stream.take(toward(travelling, journey, 100), 6))
      const reached = Option.getOrThrow(Arr.last(partWay))
      expect(reached).toBeGreaterThan(0)
      const turned = yield* collect(toward(travelling, journey, -100))
      expect(Arr.head(turned)).toEqual(Option.some(reached))
      expect(Arr.last(turned)).toEqual(Option.some(-100))
      expect(Arr.every(turned, (value) => value <= reached)).toBe(true)
      expect(Option.map((yield* Ref.get(journey)).travel, (travel) => travel.from)).toEqual(Option.some(reached))
    }))

  it.effect("the drawing rests where it is before its first travel begins", () =>
    Effect.gen(function*() {
      const journey = yield* journeyFrom(Option.some(0), Duration.millis(80))
      const drawn = yield* collect(toward(travelling, journey, 100))
      // Where the drawing is at once; the first frame, which the rest is counted from, and four more of it;
      // the frame that begins the travel; then ten frames of 16 ms.
      expect(Arr.take(drawn, 7)).toEqual([0, 0, 0, 0, 0, 0, 0])
      expect(Arr.last(drawn)).toEqual(Option.some(100))
      expect(drawn.length).toBe(17)
      expect(isMonotone(drawn)).toBe(true)
    }))

  it.effect("a drawing at rest is the one left there, itself, not one rebuilt from where it is going", () =>
    Effect.gen(function*() {
      // A drawing whose `between` rebuilds the destination's shape even at the start, as a layout would.
      const rebuilding = new Travelling<ReadonlyArray<number>>({
        between: (from, to, t) =>
          Arr.map(to, (value, index) => Option.getOrElse(Arr.get(from, index), () => value) * (1 - t) + value * t),
        duration: Duration.millis(160),
        ticks: travelling.ticks
      })
      const left: ReadonlyArray<number> = [100, 200]
      const journey = yield* journeyFrom(Option.some(left), Duration.millis(80))
      const drawn = yield* collect(toward(rebuilding, journey, [100, 200, 300]))
      Arr.forEach(Arr.take(drawn, 7), (frame) => expect(frame).toBe(left))
      expect(Arr.last(drawn)).toEqual(Option.some([100, 200, 300]))
    }))

  it.effect("the rest is counted from the first frame drawn, not from when the journey was made", () =>
    Effect.gen(function*() {
      const journey = yield* journeyFrom(Option.some(0), Duration.millis(80))
      // The page is busy for longer than the rest before the first target comes in.
      yield* TestClock.adjust("1 second")
      const drawn = yield* collect(toward(travelling, journey, 100))
      expect(Arr.take(drawn, 7)).toEqual([0, 0, 0, 0, 0, 0, 0])
      expect(drawn.length).toBe(17)
    }))

  it.effect("a new target set during the rest waits out the rest too", () =>
    Effect.gen(function*() {
      const journey = yield* journeyFrom(Option.some(0), Duration.millis(80))
      const resting = yield* collect(Stream.take(toward(travelling, journey, 100), 3))
      expect(resting).toEqual([0, 0, 0])
      const turned = yield* collect(toward(travelling, journey, -100))
      // The rest has 64 ms to run: at once, then four frames still at rest, then the travel.
      expect(Arr.take(turned, 5)).toEqual([0, 0, 0, 0, 0])
      expect(turned[5]).toBeLessThan(0)
      expect(Arr.last(turned)).toEqual(Option.some(-100))
    }))

  it.effect("with no duration a resting drawing is placed outright once the rest is over", () =>
    Effect.gen(function*() {
      const journey = yield* journeyFrom(Option.some(0), Duration.millis(40))
      const drawn = yield* collect(toward(placedOutright, journey, 100))
      // At once; the first frame, which the rest is counted from, and two more of it; then placed outright.
      expect(drawn).toEqual([0, 0, 0, 0, 100])
    }))

  it.effect("with no duration every target is placed outright", () =>
    Effect.gen(function*() {
      const journey = yield* journeyFrom(Option.some(0))
      expect(yield* collect(toward(placedOutright, journey, 100))).toEqual([100])
      expect(yield* collect(toward(placedOutright, journey, 30))).toEqual([30])
    }))

  it.effect("following a stream of targets draws every step of the way", () =>
    Effect.gen(function*() {
      const drawn = yield* collect(follow(travelling, Stream.make(40, 40, 80), Option.some(0)))
      expect(Arr.head(drawn)).toEqual(Option.some(0))
      expect(Arr.last(drawn)).toEqual(Option.some(80))
      expect(isMonotone(drawn)).toBe(true)
      expect(drawn.length).toBeGreaterThan(12)
    }))
})
