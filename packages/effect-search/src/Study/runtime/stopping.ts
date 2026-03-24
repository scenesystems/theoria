/**
 * Stopping condition checks for duration limits, target values, and no-improvement windows.
 *
 * @since 0.1.0
 */
import { Effect, Match, Number as Num, Option, Ref } from "effect"
import type { Scope } from "effect"

import type { Direction } from "../../contracts/Direction.js"
import * as Trial from "../../Trial/index.js"
import type { OptimizeSettings } from "../options.js"
import { singleDirectionFromSettings } from "../options.js"
import { markDurationExceeded, markNoImprovement, markTargetReached } from "./completion.js"
import type { StudyRuntime } from "./runtimeState.js"

const targetReachedForDirection = (
  direction: Direction,
  targetValue: number,
  candidateValue: number
): boolean =>
  Match.value(direction).pipe(
    Match.when("minimize", () => Num.lessThanOrEqualTo(candidateValue, targetValue)),
    Match.when("maximize", () => Num.greaterThanOrEqualTo(candidateValue, targetValue)),
    Match.exhaustive
  )

const numericCompletedValue = <Config>(trial: Trial.Trial<Config>): Option.Option<number> =>
  Trial.matchState({
    Running: () => Option.none(),
    Pruned: () => Option.none(),
    Failed: () => Option.none(),
    Cancelled: () => Option.none(),
    Completed: ({ value }) =>
      Match.value(value).pipe(
        Match.when(Match.number, (numericValue) => Option.some(numericValue)),
        Match.orElse(() => Option.none())
      )
  })(trial.state)

const markTargetIfReached = <Config>(
  settings: OptimizeSettings,
  runtime: StudyRuntime<Config>,
  trial: Trial.Trial<Config>
): Effect.Effect<void> =>
  Option.fromNullable(settings.targetValue).pipe(
    Option.match({
      onNone: () => Effect.void,
      onSome: (targetValue) =>
        singleDirectionFromSettings(settings).pipe(
          Option.match({
            onNone: () => Effect.void,
            onSome: (direction) =>
              numericCompletedValue(trial).pipe(
                Option.match({
                  onNone: () => Effect.void,
                  onSome: (candidateValue) =>
                    Effect.when(
                      markTargetReached(runtime.completionReasonRef),
                      () => targetReachedForDirection(direction, targetValue, candidateValue)
                    )
                })
              )
          })
        )
    })
  )

const markNoImprovementIfWindowExceeded = <Config>(
  settings: OptimizeSettings,
  runtime: StudyRuntime<Config>
): Effect.Effect<void> =>
  Option.fromNullable(settings.noImprovementWindow).pipe(
    Option.match({
      onNone: () => Effect.void,
      onSome: (window) =>
        Ref.get(runtime.noImprovementCountRef).pipe(
          Effect.flatMap((noImprovementCount) =>
            Effect.when(
              markNoImprovement(runtime.completionReasonRef),
              () => Num.greaterThanOrEqualTo(noImprovementCount, window)
            )
          )
        )
    })
  )

/**
 * Evaluates target-reached and no-improvement-window stopping conditions after each completed trial.
 *
 * @since 0.1.0
 * @category utils
 */
export const applyTrialStoppingPolicies = <Config>(
  settings: OptimizeSettings,
  runtime: StudyRuntime<Config>,
  trial: Trial.Trial<Config>
): Effect.Effect<void> =>
  markTargetIfReached(settings, runtime, trial).pipe(
    Effect.zipRight(markNoImprovementIfWindowExceeded(settings, runtime))
  )

/**
 * Forks a background fiber that marks duration exceeded after maxDuration elapses.
 *
 * @since 0.1.0
 * @category utils
 */
export const startDurationStopper = <Config>(
  settings: OptimizeSettings,
  runtime: StudyRuntime<Config>
): Effect.Effect<void, never, Scope.Scope> =>
  Option.fromNullable(settings.maxDuration).pipe(
    Option.match({
      onNone: () => Effect.void,
      onSome: (maxDuration) =>
        Effect.sleep(maxDuration).pipe(
          Effect.zipRight(markDurationExceeded(runtime.completionReasonRef)),
          Effect.forkScoped,
          Effect.asVoid
        )
    })
  )
