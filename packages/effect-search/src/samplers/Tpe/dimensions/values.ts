import { Array as Arr, Equal, Match, Option, Schema } from "effect"

import { type PrimitiveChoice, PrimitiveChoiceSchema } from "../../../contracts/Distribution.js"
import { type SamplerConfig, valueFromConfig } from "../../../internal/configAccess.js"
import type { CompletedTrialForSplit } from "../../../internal/tpe/splitTrials.js"
import type * as SearchSpace from "../../../SearchSpace/index.js"

const primitiveChoiceGuard = Schema.is(PrimitiveChoiceSchema)

const configValue = valueFromConfig

const asFiniteNumber = (value: unknown): Option.Option<number> =>
  Match.value(value).pipe(
    Match.when(Match.number, (numberValue) =>
      Match.value(Number.isFinite(numberValue)).pipe(
        Match.when(true, () => Option.some(numberValue)),
        Match.orElse(() => Option.none())
      )),
    Match.orElse(() => Option.none())
  )

const asPrimitiveChoice = (value: unknown): Option.Option<PrimitiveChoice> =>
  Option.liftPredicate(primitiveChoiceGuard)(value)

const matchesCondition = (
  config: SamplerConfig,
  condition: SearchSpace.ActivationCondition
): boolean =>
  configValue(config, condition.dimension).pipe(
    Option.match({
      onNone: () => false,
      onSome: (value) => Equal.equals(value, condition.equals)
    })
  )

const matchesAllConditions = (
  config: SamplerConfig,
  conditions: ReadonlyArray<SearchSpace.ActivationCondition>
): boolean => conditions.every((condition) => matchesCondition(config, condition))

const conditionFallbackLadder = (
  conditions: ReadonlyArray<SearchSpace.ActivationCondition>
): Array<ReadonlyArray<SearchSpace.ActivationCondition>> =>
  Arr.makeBy(conditions.length + 1, (index) => conditions.slice(0, conditions.length - index))

const collectValues = <A>(
  parameter: SearchSpace.ParameterMetadata,
  trials: ReadonlyArray<CompletedTrialForSplit>,
  conditions: ReadonlyArray<SearchSpace.ActivationCondition>,
  normalize: (value: unknown) => Option.Option<A>
): Array<A> =>
  trials.flatMap((trial) =>
    Match.value(matchesAllConditions(trial.config, conditions)).pipe(
      Match.when(true, () =>
        configValue(trial.config, parameter.name).pipe(
          Option.flatMap(normalize),
          Option.match({
            onNone: () => [],
            onSome: (value) => [value]
          })
        )),
      Match.orElse(() => [])
    )
  )

const valuesWithFallback = <A>(
  parameter: SearchSpace.ParameterMetadata,
  trials: ReadonlyArray<CompletedTrialForSplit>,
  normalize: (value: unknown) => Option.Option<A>
): Array<A> =>
  conditionFallbackLadder(parameter.activeWhen).reduce<Array<A>>(
    (selected, conditions) =>
      Match.value(selected.length > 0).pipe(
        Match.when(true, () => selected),
        Match.orElse(() => collectValues(parameter, trials, conditions, normalize))
      ),
    []
  )

export const numericValuesForParameter = (
  parameter: SearchSpace.ParameterMetadata,
  trials: ReadonlyArray<CompletedTrialForSplit>
): Array<number> => valuesWithFallback(parameter, trials, asFiniteNumber)

export const primitiveValuesForParameter = (
  parameter: SearchSpace.ParameterMetadata,
  trials: ReadonlyArray<CompletedTrialForSplit>
): Array<PrimitiveChoice> => valuesWithFallback(parameter, trials, asPrimitiveChoice)
