/**
 * Default resolution and semantic validation for study execution.
 *
 * @since 0.1.0
 */
import { Duration, Effect, Match, Number as Num, Option } from "effect"

import { type Direction } from "../../contracts/Direction.js"
import { matchObjectiveSpec, objectiveSpecFromOptions } from "../../contracts/ObjectiveSpec.js"
import { InvalidStudyConfig } from "../../Errors/index.js"
import type * as SearchSpace from "../../SearchSpace/index.js"
import { neverPruningPolicy, type PruningPolicy, stopModeOrDefault } from "../runtime/pruning.js"
import { OptimizeSettings, retryScheduleOrDefault } from "./model.js"
import type { OptimizeSettingsSource } from "./types.js"

/**
 * Extracts the comparison direction for a scalar objective. Vector objectives
 * produce `None`.
 *
 * @since 0.1.0
 * @category utils
 */
export const singleDirectionFromSettings = (settings: OptimizeSettings): Option.Option<Direction> =>
  matchObjectiveSpec({
    Single: ({ direction }) => Option.some(direction),
    Multi: () => Option.none()
  })(settings.objectiveSpec)

const concurrencyFromOptions = <Config, Space extends SearchSpace.SearchSpace>(
  options: OptimizeSettingsSource<Config, Space>
): number =>
  Match.value(options.concurrency).pipe(
    Match.when(Match.number, (value) => value),
    Match.orElse(() => 1)
  )

const evaluationsPerTrialFromOptions = <Config, Space extends SearchSpace.SearchSpace>(
  options: OptimizeSettingsSource<Config, Space>
): number =>
  Match.value(options.evaluationsPerTrial).pipe(
    Match.when(Match.number, (value) => value),
    Match.orElse(() => 1)
  )

const trialTimeoutFromOptions = <Config, Space extends SearchSpace.SearchSpace>(
  options: OptimizeSettingsSource<Config, Space>
): Option.Option<Duration.Duration> =>
  Option.fromNullable(options.trialTimeout).pipe(
    Option.flatMap((timeout) => Duration.decodeUnknown(timeout))
  )

const maxDurationFromOptions = <Config, Space extends SearchSpace.SearchSpace>(
  options: OptimizeSettingsSource<Config, Space>
): Option.Option<Duration.Duration> =>
  Option.fromNullable(options.maxDuration).pipe(
    Option.flatMap((duration) => Duration.decodeUnknown(duration))
  )

const priorWeightFromOptions = <Config, Space extends SearchSpace.SearchSpace>(
  options: OptimizeSettingsSource<Config, Space>
): number =>
  Option.fromNullable(options.priorWeight).pipe(
    Option.getOrElse(() => 1)
  )

const maxCostFromOptions = <Config, Space extends SearchSpace.SearchSpace>(
  options: OptimizeSettingsSource<Config, Space>
): Option.Option<number> => Option.fromNullable(options.maxCost)

const targetValueFromOptions = <Config, Space extends SearchSpace.SearchSpace>(
  options: OptimizeSettingsSource<Config, Space>
): Option.Option<number> => Option.fromNullable(options.targetValue)

const noImprovementWindowFromOptions = <Config, Space extends SearchSpace.SearchSpace>(
  options: OptimizeSettingsSource<Config, Space>
): Option.Option<number> => Option.fromNullable(options.noImprovementWindow)

const epsilonFromOptions = <Config, Space extends SearchSpace.SearchSpace>(
  options: OptimizeSettingsSource<Config, Space>
): number =>
  Option.fromNullable(options.epsilon).pipe(
    Option.getOrElse(() => 0)
  )

/**
 * Resolves omitted execution settings and objective direction into an immutable
 * {@link OptimizeSettings} value. Call {@link validateSettings} before execution
 * to enforce numeric and objective-kind constraints.
 *
 * @typeParam Config - Decoded configuration accepted by the source objective.
 * @typeParam Space - Compiled search space retained by the source options.
 *
 * @since 0.1.0
 * @category utils
 */
export const normalizeSettings = <Config, Space extends SearchSpace.SearchSpace>(
  options: OptimizeSettingsSource<Config, Space>
): OptimizeSettings =>
  new OptimizeSettings({
    objectiveSpec: objectiveSpecFromOptions({
      ...Option.fromNullable(options.direction).pipe(
        Option.match({
          onNone: () => ({}),
          onSome: (direction) => ({ direction })
        })
      ),
      ...Option.fromNullable(options.directions).pipe(
        Option.match({
          onNone: () => ({}),
          onSome: (directions) => ({ directions })
        })
      )
    }),
    trials: options.trials,
    concurrency: concurrencyFromOptions(options),
    evaluationsPerTrial: evaluationsPerTrialFromOptions(options),
    stopMode: stopModeOrDefault(Option.fromNullable(options.stopMode)),
    priorWeight: priorWeightFromOptions(options),
    epsilon: epsilonFromOptions(options),
    retrySchedule: retryScheduleOrDefault(Option.fromNullable(options.retrySchedule)),
    ...maxCostFromOptions(options).pipe(
      Option.match({
        onNone: () => ({}),
        onSome: (maxCost) => ({ maxCost })
      })
    ),
    ...targetValueFromOptions(options).pipe(
      Option.match({
        onNone: () => ({}),
        onSome: (targetValue) => ({ targetValue })
      })
    ),
    ...noImprovementWindowFromOptions(options).pipe(
      Option.match({
        onNone: () => ({}),
        onSome: (noImprovementWindow) => ({ noImprovementWindow })
      })
    ),
    ...maxDurationFromOptions(options).pipe(
      Option.match({
        onNone: () => ({}),
        onSome: (maxDuration) => ({ maxDuration })
      })
    ),
    ...trialTimeoutFromOptions(options).pipe(
      Option.match({
        onNone: () => ({}),
        onSome: (trialTimeout) => ({ trialTimeout })
      })
    )
  })

/**
 * Returns the configured policy or the shared policy that always continues.
 *
 * @typeParam Config - Decoded configuration accepted by the source objective.
 * @typeParam Space - Compiled search space retained by the source options.
 *
 * @since 0.1.0
 * @category constructors
 */
export const pruningPolicyFromOptions = <Config, Space extends SearchSpace.SearchSpace>(
  options: OptimizeSettingsSource<Config, Space>
): PruningPolicy =>
  Option.fromNullable(options.pruningPolicy).pipe(
    Option.match({
      onNone: () => neverPruningPolicy,
      onSome: (policy) => policy
    })
  )

/**
 * Rejects unsafe execution counts, invalid numeric limits, and stopping options
 * incompatible with the scalar or vector objective kind.
 *
 * @remarks
 * Trial count must be a non-negative integer. Concurrency and evaluations per
 * trial must be positive integers. Prior weight, epsilon, and cost budget must
 * be finite and non-negative. Target values must be finite, and no-improvement
 * windows must be positive integers. Positive epsilon is reserved for vector
 * objectives; target and no-improvement stopping are reserved for scalar ones.
 *
 * @since 0.1.0
 * @category guards
 */
export const validateSettings = (
  settings: OptimizeSettings
): Effect.Effect<void, InvalidStudyConfig> =>
  Effect.gen(function*() {
    yield* Effect.when(
      Effect.fail(new InvalidStudyConfig({ reason: "Study.optimize requires trials to be an integer >= 0" })),
      () => !Number.isInteger(settings.trials) || Num.lessThan(settings.trials, 0)
    )

    yield* Effect.when(
      Effect.fail(new InvalidStudyConfig({ reason: "Study.optimize requires concurrency to be an integer >= 1" })),
      () => !Number.isInteger(settings.concurrency) || Num.lessThan(settings.concurrency, 1)
    )

    yield* Effect.when(
      Effect.fail(new InvalidStudyConfig({ reason: "Study.optimize requires evaluationsPerTrial >= 1" })),
      () => Num.lessThan(settings.evaluationsPerTrial, 1)
    )

    yield* Effect.when(
      Effect.fail(new InvalidStudyConfig({ reason: "Study.optimize requires evaluationsPerTrial to be an integer" })),
      () => !Number.isInteger(settings.evaluationsPerTrial)
    )

    yield* Effect.when(
      Effect.fail(new InvalidStudyConfig({ reason: "Study.optimize requires priorWeight to be finite and >= 0" })),
      () => !Number.isFinite(settings.priorWeight) || Num.lessThan(settings.priorWeight, 0)
    )

    yield* Effect.when(
      Effect.fail(new InvalidStudyConfig({ reason: "Study.optimize requires epsilon to be finite and >= 0" })),
      () => !Number.isFinite(settings.epsilon) || Num.lessThan(settings.epsilon, 0)
    )

    yield* Option.fromNullable(settings.maxCost).pipe(
      Option.match({
        onNone: () => Effect.void,
        onSome: (maxCost) =>
          Effect.when(
            Effect.fail(new InvalidStudyConfig({ reason: "Study.optimize requires maxCost to be finite and >= 0" })),
            () => !Number.isFinite(maxCost) || Num.lessThan(maxCost, 0)
          )
      })
    )

    yield* Option.fromNullable(settings.targetValue).pipe(
      Option.match({
        onNone: () => Effect.void,
        onSome: (targetValue) =>
          Effect.when(
            Effect.fail(new InvalidStudyConfig({ reason: "Study.optimize requires targetValue to be finite" })),
            () => !Number.isFinite(targetValue)
          )
      })
    )

    yield* Option.fromNullable(settings.noImprovementWindow).pipe(
      Option.match({
        onNone: () => Effect.void,
        onSome: (noImprovementWindow) =>
          Effect.when(
            Effect.fail(
              new InvalidStudyConfig({
                reason: "Study.optimize requires noImprovementWindow to be an integer >= 1"
              })
            ),
            () => !Number.isInteger(noImprovementWindow) || Num.lessThan(noImprovementWindow, 1)
          )
      })
    )

    yield* matchObjectiveSpec({
      Single: () =>
        Effect.when(
          Effect.fail(
            new InvalidStudyConfig({
              reason: "Study.optimize supports epsilon only for multi-objective studies"
            })
          ),
          () => settings.epsilon !== 0
        ),
      Multi: () =>
        Effect.all([
          Effect.when(
            Effect.fail(
              new InvalidStudyConfig({
                reason: "Study.optimize supports targetValue only for single-objective studies"
              })
            ),
            () => Option.isSome(Option.fromNullable(settings.targetValue))
          ),
          Effect.when(
            Effect.fail(
              new InvalidStudyConfig({
                reason: "Study.optimize supports noImprovementWindow only for single-objective studies"
              })
            ),
            () => Option.isSome(Option.fromNullable(settings.noImprovementWindow))
          )
        ], { discard: true })
    })(settings.objectiveSpec)
  })
