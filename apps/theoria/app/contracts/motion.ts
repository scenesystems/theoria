import { Duration, Match, Schema } from "effect"
import * as Arr from "effect/Array"
import * as HashMap from "effect/HashMap"

import type { PlaceMark } from "./demo/imagined-place-provenance.js"

/**
 * Motion tokens: how long each kind of change on the page takes, and the one
 * easing they all share. This is the single home; `scripts/generate-text-tokens.ts`
 * writes `motionThemeTokens` into `styles.css` for CSS transitions, and
 * `web/view/primitives/motion.ts` hands the same values to Motion.
 *
 * A change is one of three relations between what was on the page and what is:
 *
 * - `enter`: something arrives (a line of prose, an act's answer).
 * - `shift`: something already there moves (a disc, a name to the stage).
 * - `exit`: something leaves; shorter than arriving, so the new state leads.
 */
export const MotionRelation = Schema.Literal("enter", "shift", "exit")

export type MotionRelation = typeof MotionRelation.Type

const entry = <K, V>(k: K, v: V): readonly [K, V] => [k, v]

const durations = HashMap.make(
  entry<MotionRelation, Duration.Duration>("enter", Duration.millis(240)),
  entry<MotionRelation, Duration.Duration>("shift", Duration.millis(320)),
  entry<MotionRelation, Duration.Duration>("exit", Duration.millis(120))
)

export const motionDuration = (relation: MotionRelation): Duration.Duration => HashMap.unsafeGet(durations, relation)

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

/** Delay from pointer entry to answering a mark. */
export const answerOpenDelay = (mark: PlaceMark): Duration.Duration =>
  Match.value(mark).pipe(
    Match.tag("Line", () => Duration.millis(320)),
    Match.tag("Feature", "Disc", "Signature", "Digest", "Trial", "Inference", "Note", "CodeLine", () =>
      Duration.millis(120)),
    Match.exhaustive
  )

/** Grace for crossing the gap between a mark and its answer. */
export const answerCloseGrace: Duration.Duration = Duration.millis(150)

/** One ease for everything that moves: quick to leave, soft to land. */
export const motionEase: readonly [number, number, number, number] = [0.2, 0, 0, 1]

export const motionEaseCss = `cubic-bezier(${Arr.join(Arr.map(motionEase, String), ", ")})`

const durationCss = (duration: Duration.Duration): string => `${String(Duration.toMillis(duration))}ms`

/** `--th-motion-duration-<relation>` for each relation, then `--ease-theme`. */
export const motionThemeTokens: ReadonlyArray<readonly [string, string]> = Arr.append(
  Arr.map(
    MotionRelation.literals,
    (relation) => entry(`--th-motion-duration-${relation}`, durationCss(motionDuration(relation)))
  ),
  entry("--ease-theme", motionEaseCss)
)
