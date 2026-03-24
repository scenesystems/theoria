/**
 * Study lifecycle transition predicates.
 *
 * @since 0.1.0
 */
import { Match } from "effect"

/**
 * @since 0.1.0
 * @category type-level
 */
export type StudyLifecycle = "Created" | "Running" | "Paused" | "Completed" | "Failed" | "Cancelled"

const canTransitionFromCreated = (target: StudyLifecycle): boolean =>
  Match.value(target).pipe(
    Match.when("Created", () => false),
    Match.when("Running", () => true),
    Match.when("Paused", () => false),
    Match.when("Completed", () => false),
    Match.when("Failed", () => false),
    Match.when("Cancelled", () => false),
    Match.exhaustive
  )

const canTransitionFromRunning = (target: StudyLifecycle): boolean =>
  Match.value(target).pipe(
    Match.when("Created", () => false),
    Match.when("Running", () => false),
    Match.when("Paused", () => true),
    Match.when("Completed", () => true),
    Match.when("Failed", () => true),
    Match.when("Cancelled", () => true),
    Match.exhaustive
  )

const canTransitionFromPaused = (target: StudyLifecycle): boolean =>
  Match.value(target).pipe(
    Match.when("Created", () => false),
    Match.when("Running", () => true),
    Match.when("Paused", () => false),
    Match.when("Completed", () => false),
    Match.when("Failed", () => false),
    Match.when("Cancelled", () => true),
    Match.exhaustive
  )

/**
 * Returns whether a lifecycle transition from `current` to `target` is valid.
 *
 * @since 0.1.0
 * @category utils
 */
export const canTransitionLifecycle = (current: StudyLifecycle, target: StudyLifecycle): boolean =>
  Match.value(current).pipe(
    Match.when("Created", () => canTransitionFromCreated(target)),
    Match.when("Running", () => canTransitionFromRunning(target)),
    Match.when("Paused", () => canTransitionFromPaused(target)),
    Match.when("Completed", () => false),
    Match.when("Failed", () => false),
    Match.when("Cancelled", () => false),
    Match.exhaustive
  )
