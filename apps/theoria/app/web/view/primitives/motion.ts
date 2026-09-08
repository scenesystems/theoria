import { Duration } from "effect"
import type { Transition } from "motion/react"

import {
  motionArrivalBudget,
  motionDuration,
  motionEase,
  motionStagger,
  motionValueWash,
  motionWalkDraw
} from "../../../contracts/motion.js"

const seconds = (duration: Duration.Duration): number => Duration.toSeconds(duration)

/**
 * The theme's transition, set once on `MotionConfig`: values arrive over
 * `enter`. Something already on the page moving takes `shift`, which the
 * drawing's travel reads for itself. Feature code passes its own
 * `transition` only for exits and staggers.
 */
export const themeTransition: Transition = {
  duration: seconds(motionDuration("enter")),
  ease: motionEase
}

/** Leaving is quicker than arriving, so the new state leads. */
export const exitTransition: Transition = { duration: seconds(motionDuration("exit")), ease: motionEase }

/** The walk drawing itself once the search settles. */
export const walkDrawTransition: Transition = { duration: seconds(motionWalkDraw), ease: motionEase }

/** A changed value's wash settling to nothing. */
export const valueWashTransition: Transition = { duration: seconds(motionValueWash), ease: motionEase }

/** Each of several things arriving together takes two thirds of a lone arrival; the stagger makes up the rest. */
const staggeredDuration: Duration.Duration = Duration.times(motionDuration("enter"), 2 / 3)

/** The latest one of them may start and still land within the arrival budget. */
const lastStart: Duration.Duration = Duration.subtract(motionArrivalBudget, staggeredDuration)

/**
 * The transition for the `index`th of several things arriving together: each
 * starts `motionStagger` after the one before, and none starts later than the
 * budget allows, so a long list does not trail.
 */
export const staggeredArrival = (index: number): Transition => ({
  delay: seconds(Duration.min(Duration.times(motionStagger, index), lastStart)),
  duration: seconds(staggeredDuration),
  ease: motionEase
})

/** Hidden, four pixels low: where anything arriving starts. Motion drops the rise under reduced motion. */
export const arrivalFrom = { opacity: 0, y: 4 }
export const arrivedAt = { opacity: 1, y: 0 }
export const departed = { opacity: 0 }
