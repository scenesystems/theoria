import { Clock, Data, Duration, Effect, Equal, Option, Ref, Stream } from "effect"
import { cubicBezier } from "motion"

import { motionEase } from "../../contracts/motion.js"
import { frames } from "../platform/AnimationFrame.js"

/**
 * A value drawn by hand travelling toward its targets: the Effect-native
 * counterpart of a Motion layout animation, for values Motion cannot animate
 * because what they draw is computed, not styled. The drawing is a stream of
 * values, one per frame, so whatever reads it draws every step in full and
 * nothing is interpolated in pixels behind its back.
 *
 * The theme's ease as a function of progress; the same curve Motion and CSS use.
 */
const ease: (t: number) => number = cubicBezier(...motionEase)

/** How to draw one value `t` of the way from another, `t` in [0, 1]. */
export type Between<A> = (from: A, to: A, t: number) => A

/**
 * How a kind of value travels: how one is drawn part of the way to another,
 * how long a travel takes (none: it is placed outright, for reduced motion),
 * and what paces the frames (the page's frame loop; a test's own clock).
 *
 * @since 0.3.0
 */
export class Travelling<A> extends Data.Class<{
  readonly between: Between<A>
  readonly duration: Duration.Duration
  readonly ticks: Stream.Stream<void>
}> {}

/**
 * One travel: from where the drawing was when the target was set, toward the
 * target. It starts with the first frame drawn after the target is set, not
 * when the target is set: a page busy for a while between the two (a merge
 * arriving, a search starting) would otherwise spend the travel's time before
 * anything of it was seen. It does not start before `notBefore` either: until
 * then the drawing rests where it is, whatever the target — the time, say,
 * that something else on the page needs to leave first.
 */
export class Travel<A> extends Data.Class<{
  readonly from: A
  readonly to: A
  readonly startedAt: Option.Option<number>
  readonly notBefore: number
}> {}

/**
 * Where a drawing is on its way, and the rest it still owes: nothing on its
 * way until the first target is set; at rest until the first frame of the
 * first target is drawn and `rest` has passed from then. The rest is counted
 * from that first frame, not from when the journey was made, for the same
 * reason a travel starts with its first frame: what the drawing rests for —
 * lines leaving the page, say — leaves from the first frame that shows the
 * new target, however long the page took to get to it.
 */
export class Journey<A> extends Data.Class<{
  readonly travel: Option.Option<Travel<A>>
  readonly rest: Duration.Duration
}> {}

/** How far along a travel is at `time`: 0 until it starts, 1 once it has landed; placed outright once it may start, given no duration. */
const progressAt = <A>(travelling: Travelling<A>, travel: Travel<A>, time: number): number =>
  Duration.isZero(travelling.duration) && time >= travel.notBefore
    ? 1
    : Option.match(travel.startedAt, {
      onNone: () => 0,
      onSome: (startedAt) =>
        Duration.isZero(travelling.duration)
          ? 0
          : Math.min(1, Math.max(0, (time - startedAt) / Duration.toMillis(travelling.duration)))
    })

/** The travel as begun at `time`, or when it may begin if that is later, if it had not begun already. */
const begunAt = <A>(travel: Travel<A>, time: number): Travel<A> =>
  Option.isSome(travel.startedAt)
    ? travel
    : new Travel({ ...travel, startedAt: Option.some(Math.max(time, travel.notBefore)) })

/** The journey with the rest it owes taken from `time`: its travel may not begin before the rest has passed. */
const restedFrom = <A>(journey: Journey<A>, time: number): Journey<A> =>
  new Journey({
    travel: Option.map(
      journey.travel,
      (travel) =>
        new Travel({ ...travel, notBefore: Math.max(travel.notBefore, time + Duration.toMillis(journey.rest)) })
    ),
    rest: Duration.zero
  })

/** How far along a journey's travel is at `time`: nowhere while it still owes a rest; landed when nothing is on its way. */
const journeyProgressAt = <A>(travelling: Travelling<A>, journey: Journey<A>, time: number): number =>
  Option.match(journey.travel, {
    onNone: () => 1,
    onSome: (travel) => Duration.isZero(journey.rest) ? progressAt(travelling, travel, time) : 0
  })

/**
 * What is drawn `progress` of the way along a travel. A travel yet to begin
 * draws where it starts from, itself — the same value, not a copy — so a
 * drawing at rest is the last one left, exactly, and nothing on the way to
 * the target shows before the travel does. A landed travel draws its target
 * itself, so whatever reads the drawing can tell it has arrived.
 */
const drawnAt = <A>(travelling: Travelling<A>, travel: Travel<A>, progress: number): A =>
  progress <= 0 ? travel.from : progress >= 1 ? travel.to : travelling.between(travel.from, travel.to, ease(progress))

/**
 * A journey from where the last drawing was left, so a new stream of targets
 * carries on from there instead of starting somewhere else; resting there for
 * `rest` from the first frame drawn before any target is travelled toward.
 */
export const journeyFrom = <A>(
  from: Option.Option<A>,
  rest: Duration.Duration = Duration.zero
): Effect.Effect<Ref.Ref<Journey<A>>> =>
  Ref.make(
    new Journey({
      travel: Option.map(from, (at) => new Travel({ from: at, to: at, startedAt: Option.none(), notBefore: 0 })),
      rest
    })
  )

/**
 * The values drawn from now until `to` is reached: where the drawing is at
 * once, then one per tick from the first tick on, the last being `to` itself.
 * A target set again while its travel is under way continues that travel; a
 * new target starts a new travel from wherever the drawing is at that moment,
 * so the drawing never jumps. The first target ever is placed outright: there
 * is nowhere to travel from. A journey owing a rest takes it from the first
 * frame drawn of a travel: the drawing stays where it was left until the
 * rest has passed, whatever targets come in meanwhile.
 */
export const toward = <A>(
  travelling: Travelling<A>,
  journey: Ref.Ref<Journey<A>>,
  to: A
): Stream.Stream<A> =>
  Stream.unwrap(
    Effect.gen(function*() {
      const now = yield* Clock.currentTimeMillis
      const owed = yield* Ref.get(journey)
      const travel = Option.match(owed.travel, {
        onNone: () => new Travel({ from: to, to, startedAt: Option.none(), notBefore: now }),
        onSome: (current) =>
          Equal.equals(current.to, to)
            ? current
            : new Travel({
              from: drawnAt(travelling, current, journeyProgressAt(travelling, owed, now)),
              to,
              startedAt: Option.none(),
              notBefore: current.notBefore
            })
      })
      const set = new Journey({ ...owed, travel: Option.some(travel) })
      yield* Ref.set(journey, set)

      if (Equal.equals(travel.from, travel.to)) {
        return Stream.make(travel.to)
      }
      // The first tick takes the rest owed and begins the travel; every tick draws it as it stands at that moment.
      const tick = Effect.gen(function*() {
        const time = yield* Clock.currentTimeMillis
        const begun = yield* Ref.updateAndGet(journey, (current) => {
          const rested = restedFrom(current, time)
          return new Journey({ ...rested, travel: Option.map(rested.travel, (found) => begunAt(found, time)) })
        })
        return journeyProgressAt(travelling, begun, time)
      })
      return Stream.concat(
        Stream.make(journeyProgressAt(travelling, set, now)),
        Stream.mapEffect(travelling.ticks, () => tick)
      )
        .pipe(
          Stream.takeUntil((progress) => progress >= 1),
          Stream.map((progress) => drawnAt(travelling, travel, progress))
        )
    })
  )

/**
 * The drawing that follows `targets`: each new target is travelled toward
 * from wherever the drawing is, and the drawing is emitted every frame on the
 * way. `from` is where the drawing was left before, if anywhere.
 *
 * @since 0.3.0
 */
export const follow = <A, E, R>(
  travelling: Travelling<A>,
  targets: Stream.Stream<A, E, R>,
  from: Option.Option<A>
): Stream.Stream<A, E, R> =>
  Stream.unwrap(
    Effect.map(journeyFrom(from), (journey) =>
      Stream.flatMap(targets, (to) => toward(travelling, journey, to), { switch: true }))
  )

/** A travel paced by the page's frame loop over `duration`; none places outright. */
export const travellingOver = <A>(between: Between<A>, duration: Duration.Duration): Travelling<A> =>
  new Travelling({ between, duration, ticks: frames })
