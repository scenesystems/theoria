import { Duration, Match, Schema } from "effect"
import * as Arr from "effect/Array"
import * as HashMap from "effect/HashMap"

/**
 * Motion tokens: how long each kind of change on the page takes, and the one
 * eases they move with. This is the single home; `scripts/generate-text-tokens.ts`
 * writes `motionThemeTokens` into `text-tokens.generated.css`, which
 * `transitionClassName` in `web/view/primitives/designSystem.ts` reads for
 * CSS transitions, and `web/view/primitives/motion.ts` hands the same values
 * to Motion.
 *
 * A change is one of five relations between what was on the page and what is:
 *
 * - `enter`: something arrives (a line of prose, an act's answer).
 * - `shift`: something already there moves (a disc between arrangements, the band's row).
 * - `exit`: something leaves; shorter than arriving, so the new state leads.
 * - `respond`: a control answers the pointer or the focus (a hover wash, a
 *   pressed pill, a link's colour); quicker than anything arriving, so it
 *   reads as the control's own, not as the page changing.
 * - `follow`: something the reader let go of settles where the gesture sent it
 *   (a drawer after a swipe); it leaves at the finger's speed and lands soft,
 *   so it has its own ease.
 */
export const MotionRelation = Schema.Literal("enter", "shift", "exit", "respond", "follow")

export type MotionRelation = typeof MotionRelation.Type

const entry = <K, V>(k: K, v: V): readonly [K, V] => [k, v]

const durations = HashMap.make(
  entry<MotionRelation, Duration.Duration>("enter", Duration.millis(240)),
  entry<MotionRelation, Duration.Duration>("shift", Duration.millis(320)),
  entry<MotionRelation, Duration.Duration>("exit", Duration.millis(120)),
  entry<MotionRelation, Duration.Duration>("respond", Duration.millis(150)),
  entry<MotionRelation, Duration.Duration>("follow", Duration.millis(300))
)

export const motionDuration = (relation: MotionRelation): Duration.Duration => HashMap.unsafeGet(durations, relation)

/**
 * The longest anything resting for an exit waits for it. What leaves signals
 * when it has left, and what rested for it moves on at the signal; the bound
 * is only for a signal that never comes, so nothing rests for good. It is a
 * page's patience, not a multiple of the exit: a main thread held by a long
 * task stretches an exit well past its own length, and a bound near that
 * length would end the rest with the old lines still leaving — and the drawing
 * travelling under them. Two seconds is what a person waits before a page
 * reads as stuck, and well inside what the search itself is given to answer.
 */
export const motionExitBound: Duration.Duration = Duration.seconds(2)

/** The gap between things arriving together, line after line. */
export const motionStagger: Duration.Duration = Duration.millis(20)

/** The longest a staggered arrival may take from the first thing starting to the last. */
export const motionArrivalBudget: Duration.Duration = Duration.millis(300)

/**
 * How long the walk through the place takes to draw itself once the search
 * settles: front to back, in the order the features were named, slow enough
 * to be followed. Movement, so reduced motion draws it whole at once.
 */
export const motionWalkDraw: Duration.Duration = Duration.millis(900)

/**
 * How long a changed value stays washed in its tone before settling: longer
 * than anything moving, so the eye finds it after the drawing has landed.
 * Colour alone, which reduced motion keeps.
 */
export const motionValueWash: Duration.Duration = Duration.millis(1200)

/**
 * One breath of a placeholder standing in for pending content: slower than
 * anything arriving, so it reads as waiting rather than as change. Movement
 * of a kind, so reduced motion holds it still.
 */
export const motionPulse: Duration.Duration = Duration.seconds(2)

/** One ease for everything the page moves: quick to leave, soft to land. */
export const motionEase: readonly [number, number, number, number] = [0.2, 0, 0, 1]

/**
 * The ease of something following a gesture: it leaves at the speed the
 * finger gave it, then lands softer than the page's own ease, so letting go
 * reads as the thing carrying on rather than the page taking over.
 */
export const motionFollowEase: readonly [number, number, number, number] = [0.32, 0.72, 0, 1]

/**
 * The name of the ease a relation moves with: `theme` for everything the page
 * itself moves, `follow` for what a gesture set moving. The name is the CSS
 * token's (`--ease-<name>`) and the utility's (`ease-<name>`).
 */
export const MotionEase = Schema.Literal("theme", "follow")

export type MotionEase = typeof MotionEase.Type

export const motionEaseFor = (relation: MotionRelation): MotionEase =>
  Match.value(relation).pipe(
    Match.withReturnType<MotionEase>(),
    Match.when("follow", () => "follow"),
    Match.when("enter", () => "theme"),
    Match.when("shift", () => "theme"),
    Match.when("exit", () => "theme"),
    Match.when("respond", () => "theme"),
    Match.exhaustive
  )

const bezierCss = (ease: readonly [number, number, number, number]): string =>
  `cubic-bezier(${Arr.join(Arr.map(ease, String), ", ")})`

export const motionEaseCurve = (ease: MotionEase): readonly [number, number, number, number] =>
  Match.value(ease).pipe(
    Match.when("theme", () => motionEase),
    Match.when("follow", () => motionFollowEase),
    Match.exhaustive
  )

export const motionEaseCss = bezierCss(motionEase)

const durationCss = (duration: Duration.Duration): string => `${String(Duration.toMillis(duration))}ms`

/** `--th-motion-duration-<relation>` for each relation, then `--ease-<ease>` for each ease. */
export const motionThemeTokens: ReadonlyArray<readonly [string, string]> = Arr.appendAll(
  Arr.map(
    MotionRelation.literals,
    (relation) => entry(`--th-motion-duration-${relation}`, durationCss(motionDuration(relation)))
  ),
  Arr.map(MotionEase.literals, (ease) => entry(`--ease-${ease}`, bezierCss(motionEaseCurve(ease))))
)
