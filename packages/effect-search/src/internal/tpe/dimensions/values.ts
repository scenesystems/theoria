/**
 * TPE dimension value extraction — collects observed parameter values from completed trials with conditional fallback.
 *
 * @since 0.1.0
 */
import { isFinite } from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Data, Equal, Match, Number as Num, Option, Schema, Tuple } from "effect"

import { Choice } from "../../../Distribution.js"
import { type SamplerConfig, valueFromConfig } from "../../../internal/configAccess.js"
import type { CompletedTrialForSplit } from "../../../internal/tpe/splitTrials.js"
import type * as SearchSpace from "../../../SearchSpace.js"

const primitiveChoiceGuard = Schema.is(Choice)

const configValue = valueFromConfig

const asFiniteNumber = (value: unknown): Option.Option<number> =>
  Match.value(value).pipe(
    Match.when(Match.number, (numberValue) =>
      Match.value(isFinite(numberValue)).pipe(
        Match.when(true, () => Option.some(numberValue)),
        Match.orElse(() => Option.none())
      )),
    Match.orElse(() => Option.none())
  )

const asChoice = (value: unknown): Option.Option<Choice> => Option.liftPredicate(primitiveChoiceGuard)(value)

const matchesCondition = (
  config: SamplerConfig,
  condition: SearchSpace.Condition
): boolean =>
  configValue(config, condition.dimension).pipe(
    Option.match({
      onNone: () => false,
      onSome: (value) => Equal.equals(value, condition.equals)
    })
  )

const matchesAllConditions = (
  config: SamplerConfig,
  conditionsInput: Iterable<SearchSpace.Condition>
): boolean => {
  const conditions = Arr.fromIterable(conditionsInput)
  return Arr.every(conditions, (condition) => matchesCondition(config, condition))
}

const conditionFallbackLadder = (
  conditionsInput: Iterable<SearchSpace.Condition>
) => {
  const conditions = Arr.fromIterable(conditionsInput)
  return Arr.makeBy(
    Num.increment(Arr.length(conditions)),
    (index) => Arr.take(conditions, Num.subtract(Arr.length(conditions), index))
  )
}

const collectValues = <A>(
  parameter: SearchSpace.Parameter,
  trialsInput: Iterable<CompletedTrialForSplit>,
  conditionsInput: Iterable<SearchSpace.Condition>,
  normalize: (value: unknown) => Option.Option<A>
): Array<[CompletedTrialForSplit, A]> => {
  const trials = Arr.fromIterable(trialsInput)
  const conditions = Arr.fromIterable(conditionsInput)
  return Arr.flatMap(trials, (trial) =>
    Match.value(matchesAllConditions(trial.config, conditions)).pipe(
      Match.when(true, () =>
        configValue(trial.config, parameter.name).pipe(
          Option.flatMap(normalize),
          Option.match({
            onNone: () => Arr.empty<[CompletedTrialForSplit, A]>(),
            onSome: (value) => Arr.of(Tuple.make(trial, value))
          })
        )),
      Match.orElse(() => Arr.empty<[CompletedTrialForSplit, A]>())
    ))
}

const valuesWithFallback = <A>(
  parameter: SearchSpace.Parameter,
  trialsInput: Iterable<CompletedTrialForSplit>,
  normalize: (value: unknown) => Option.Option<A>
) => {
  const trials = Arr.fromIterable(trialsInput)
  return Arr.reduce(
    conditionFallbackLadder(parameter.activeWhen),
    Arr.empty<[CompletedTrialForSplit, A]>(),
    (selected, conditions) =>
      Match.value(Num.isGreaterThan(Arr.length(selected), 0)).pipe(
        Match.when(true, () => selected),
        Match.orElse(() => collectValues(parameter, trials, conditions, normalize))
      )
  )
}

/**
 * Extracts finite numeric observed values for a parameter from completed
 * trials, falling back through progressively relaxed activation conditions.
 *
 * The fallback chain ensures density estimation always has observations to
 * fit, even when conditional activation filters out most trials.
 *
 * @see {@link primitiveValuesForParameter} for categorical extraction
 * @since 0.1.0
 * @category constructors
 */
export const numericValuesForParameter = (
  parameter: SearchSpace.Parameter,
  trialsInput: Iterable<CompletedTrialForSplit>
): Array<number> => weightedNumericValuesForParameter(parameter, trialsInput).values

/**
 * Extracts primitive choice values for a categorical parameter from completed
 * trials, falling back through progressively relaxed activation conditions.
 *
 * Values are matched against the parameter's declared choices to ensure
 * the categorical Parzen estimator receives valid observations.
 *
 * @see {@link numericValuesForParameter} for numeric extraction
 * @since 0.1.0
 * @category constructors
 */
export const primitiveValuesForParameter = (
  parameter: SearchSpace.Parameter,
  trialsInput: Iterable<CompletedTrialForSplit>
): Array<Choice> => weightedPrimitiveValuesForParameter(parameter, trialsInput).values

/**
 * Observed values with their predetermined kernel weights. `weights` is present only when every
 * contributing trial carries a MOTPE `belowWeight`, as Optuna's `predetermined_weights` are.
 *
 * @since 0.9.0
 * @category models
 */
export class WeightedValues<A> extends Data.Class<{
  readonly values: Array<A>
  readonly weights: Option.Option<Array<number>>
}> {}

const weighted = <A>(pairs: ReadonlyArray<[CompletedTrialForSplit, A]>): WeightedValues<A> =>
  new WeightedValues({
    values: Arr.map(pairs, ([, value]) => value),
    weights: Option.all(Arr.map(pairs, ([trial]) => Option.fromNullishOr(trial.belowWeight)))
  })

/**
 * Numeric observations for a parameter with their MOTPE below weights, filtered exactly as
 * {@link numericValuesForParameter} filters them.
 *
 * @since 0.9.0
 * @category constructors
 */
export const weightedNumericValuesForParameter = (
  parameter: SearchSpace.Parameter,
  trialsInput: Iterable<CompletedTrialForSplit>
): WeightedValues<number> => weighted(valuesWithFallback(parameter, Arr.fromIterable(trialsInput), asFiniteNumber))

/**
 * Categorical observations for a parameter with their MOTPE below weights, filtered exactly as
 * {@link primitiveValuesForParameter} filters them.
 *
 * @since 0.9.0
 * @category constructors
 */
export const weightedPrimitiveValuesForParameter = (
  parameter: SearchSpace.Parameter,
  trialsInput: Iterable<CompletedTrialForSplit>
): WeightedValues<Choice> => weighted(valuesWithFallback(parameter, Arr.fromIterable(trialsInput), asChoice))
