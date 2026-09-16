/**
 * Prior trial seed validation and runtime seed construction for warm-starting studies.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Effect, Match, Number as Num, Option, Schema } from "effect"

import { match, type Objective } from "../../../Objective.js"
import { dimensionCount, isFiniteValue, type Value } from "../../../Objective.js"
import { InvalidStudyConfig } from "../../../SearchError.js"
import type * as SearchSpace from "../../../SearchSpace.js"
import * as Trial from "../../../Trial.js"
import type { OptimizePlan } from "../options/plan.js"

/**
 * Internal seed state for study initialization, carrying prior trials and the starting trial number.
 *
 * @since 0.1.0
 * @category models
 */
export class RuntimeSeed<Config = unknown> extends Data.Class<{
  readonly initialTrials: ReadonlyArray<Trial.Trial<Config>>
  readonly startTrialNumber: number
}> {}

const priorTrialFailure = (index: number, reason: string): InvalidStudyConfig =>
  new InvalidStudyConfig({
    reason: `Study.optimize priorTrials[${index}] ${reason}`
  })

const isFiniteSingleValue = (value: Value): boolean =>
  Match.value(value).pipe(
    Match.when(Match.number, (entry) => Number.isFinite(entry)),
    Match.orElse(() => false)
  )

const isCompatiblePriorValue = (objectiveSpec: Objective, value: Value): boolean =>
  match({
    Single: () => isFiniteSingleValue(value),
    Multi: ({ directions }) => isFiniteValue(value) && dimensionCount(value) === directions.length
  })(objectiveSpec)

const isFiniteNonNegative = (value: number): boolean => Number.isFinite(value) && Num.greaterThanOrEqualTo(value, 0)

const decodePriorConfig = <Space extends SearchSpace.SearchSpace>(
  space: Space,
  index: number,
  config: unknown
): Effect.Effect<SearchSpace.Type<Space>, InvalidStudyConfig> =>
  Schema.decodeUnknown(space.schema)(config).pipe(
    Effect.mapError(() => priorTrialFailure(index, "does not decode against the provided search space"))
  )

const validatePriorCost = (index: number, cost: number): Effect.Effect<void, InvalidStudyConfig> =>
  Match.value(isFiniteNonNegative(cost)).pipe(
    Match.when(true, () => Effect.void),
    Match.orElse(() =>
      Effect.fail(priorTrialFailure(index, "cost must be a finite number greater than or equal to zero"))
    )
  )

const validatePriorValue = (
  index: number,
  objectiveSpec: Objective,
  value: Value
): Effect.Effect<void, InvalidStudyConfig> =>
  Match.value(isCompatiblePriorValue(objectiveSpec, value)).pipe(
    Match.when(true, () => Effect.void),
    Match.orElse(() =>
      Effect.fail(priorTrialFailure(index, "value does not match the configured objective specification"))
    )
  )

const trialNumberFromIndex = (index: number, totalPriorTrials: number): number => index - totalPriorTrials

const priorTrialToRuntimeTrial = <Config>(
  index: number,
  totalPriorTrials: number,
  config: Config,
  value: Value,
  cost: Option.Option<number>
): Trial.Trial<Config> =>
  Trial.make({
    trialNumber: trialNumberFromIndex(index, totalPriorTrials),
    config,
    state: Trial.Completed({
      value,
      duration: 0,
      retryCount: 0
    }),
    prior: true,
    ...Option.match(cost, {
      onNone: () => ({}),
      onSome: (resolvedCost) => ({ cost: resolvedCost })
    })
  })

const normalizedPriorTrials = <Space extends SearchSpace.SearchSpace>(
  options: OptimizePlan<SearchSpace.Type<Space>, Space>,
  objectiveSpec: Objective
): Effect.Effect<ReadonlyArray<Trial.Trial<SearchSpace.Type<Space>>>, InvalidStudyConfig> =>
  Option.fromNullable(options.priorTrials).pipe(
    Option.match({
      onNone: () => Effect.succeed(Arr.empty<Trial.Trial<SearchSpace.Type<Space>>>()),
      onSome: (priorTrials) => {
        const trials = Arr.fromIterable(priorTrials)
        const totalPriorTrials = Arr.length(trials)

        return Effect.forEach(
          Arr.map(trials, (priorTrial, index) => ({ priorTrial, index })),
          ({ priorTrial, index }) =>
            Effect.gen(function*() {
              const decodedConfig = yield* decodePriorConfig(options.space, index, priorTrial.config)
              yield* validatePriorValue(index, objectiveSpec, priorTrial.value)
              const costOption = Option.fromNullable(priorTrial.cost)

              yield* Option.match(costOption, {
                onNone: () => Effect.void,
                onSome: (cost) => validatePriorCost(index, cost)
              })

              return priorTrialToRuntimeTrial(index, totalPriorTrials, decodedConfig, priorTrial.value, costOption)
            })
        )
      }
    })
  )

/**
 * Validates and converts prior trials into runtime format, merging them with an existing seed for warm-starting.
 *
 * @since 0.1.0
 * @category utils
 */
export const mergeSeedWithPriorTrials = <Space extends SearchSpace.SearchSpace>(
  options: OptimizePlan<SearchSpace.Type<Space>, Space>,
  objectiveSpec: Objective,
  seed: RuntimeSeed<SearchSpace.Type<Space>>
): Effect.Effect<RuntimeSeed<SearchSpace.Type<Space>>, InvalidStudyConfig> =>
  normalizedPriorTrials(options, objectiveSpec).pipe(
    Effect.map(
      (priorTrials) =>
        new RuntimeSeed({
          initialTrials: Arr.appendAll(priorTrials, seed.initialTrials),
          startTrialNumber: Num.max(seed.startTrialNumber, 0)
        })
    )
  )
