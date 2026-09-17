/**
 * Study lifecycle transition predicates.
 *
 * @since 0.1.0
 * @module
 */
import { Match, Schema } from "effect"
import { dual } from "effect/Function"

/**
 * Lifecycle phases independent of an evaluation or search algorithm.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Lifecycle = Schema.Literal("Created", "Running", "Paused", "Completed", "Failed", "Cancelled")

/**
 * A lifecycle phase decoded by the study schema.
 *
 * @since 0.1.0
 * @category type-level
 */
export type Lifecycle = typeof Lifecycle.Type

const canTransitionFromCreated = (target: Lifecycle): boolean =>
  Match.value(target).pipe(
    Match.when("Created", () => false),
    Match.when("Running", () => true),
    Match.when("Paused", () => false),
    Match.when("Completed", () => false),
    Match.when("Failed", () => false),
    Match.when("Cancelled", () => true),
    Match.exhaustive
  )

const canTransitionFromRunning = (target: Lifecycle): boolean =>
  Match.value(target).pipe(
    Match.when("Created", () => false),
    Match.when("Running", () => false),
    Match.when("Paused", () => true),
    Match.when("Completed", () => true),
    Match.when("Failed", () => true),
    Match.when("Cancelled", () => true),
    Match.exhaustive
  )

const canTransitionFromPaused = (target: Lifecycle): boolean =>
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
export const canTransition: {
  (target: Lifecycle): (self: Lifecycle) => boolean
  (self: Lifecycle, target: Lifecycle): boolean
} = dual(2, (self: Lifecycle, target: Lifecycle): boolean =>
  Match.value(self).pipe(
    Match.when("Created", () => canTransitionFromCreated(target)),
    Match.when("Running", () => canTransitionFromRunning(target)),
    Match.when("Paused", () => canTransitionFromPaused(target)),
    Match.when("Completed", () => false),
    Match.when("Failed", () => false),
    Match.when("Cancelled", () => false),
    Match.exhaustive
  ))
