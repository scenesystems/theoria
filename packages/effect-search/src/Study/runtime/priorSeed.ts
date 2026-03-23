/**
 * Prior trial seed validation and runtime seed construction for warm-starting studies.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Effect, Match, Number as Num, Option, Schema } from "effect"

import { matchObjectiveSpec, type ObjectiveSpec } from "../../contracts/ObjectiveSpec.js"
import { isFiniteObjectiveValue, objectiveDimensionCount, type ObjectiveValue } from "../../contracts/ObjectiveValue.js"
import { InvalidStudyConfig } from "../../Errors/index.js"
import type * as SearchSpace from "../../SearchSpace/index.js"
import * as Trial from "../../Trial/index.js"
import type { OptimizePlan } from "../options.js"

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

const isFiniteSingleObjectiveValue = (value: ObjectiveValue): boolean =>
  Match.value(value).pipe(
    Match.when(Match.number, (entry) => Number.isFinite(entry)),
    Match.orElse(() => false)
  )

const isCompatiblePriorValue = (objectiveSpec: ObjectiveSpec, value: ObjectiveValue): boolean =>
  matchObjectiveSpec({
    Single: () => isFiniteSingleObjectiveValue(value),
    Multi: ({ directions }) => isFiniteObjectiveValue(value) && objectiveDimensionCount(value) === directions.length
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
  objectiveSpec: ObjectiveSpec,
  value: ObjectiveValue
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
  value: ObjectiveValue,
  cost: Option.Option<number>
): Trial.Trial<Config> =>
  new Trial.Trial({
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
  objectiveSpec: ObjectiveSpec
): Effect.Effect<ReadonlyArray<Trial.Trial<SearchSpace.Type<Space>>>, InvalidStudyConfig> =>
  Option.fromNullable(options.priorTrials).pipe(
    Option.match({
      onNone: () => Effect.succeed(Arr.empty<Trial.Trial<SearchSpace.Type<Space>>>()),
      onSome: (priorTrials) => {
        const totalPriorTrials = priorTrials.length

        return Effect.forEach(
          Arr.map(priorTrials, (priorTrial, index) => ({ priorTrial, index })),
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
  objectiveSpec: ObjectiveSpec,
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
