/**
 * TPE dimension value extraction — collects observed parameter values from completed trials with conditional fallback.
 *
 * @since 0.1.0
 */
import { Array as Arr, Equal, Match, Number as Num, Option, Schema } from "effect"

import { type PrimitiveChoice, PrimitiveChoiceSchema } from "../../../contracts/Distribution.js"
import { type SamplerConfig, valueFromConfig } from "../../../internal/configAccess.js"
import type { TrialSplit } from "../../../internal/tpe/splitTrials.js"
import type * as SearchSpace from "../../../SearchSpace/index.js"

const primitiveChoiceGuard = Schema.is(PrimitiveChoiceSchema)
const finiteNumberGuard = Schema.is(Schema.Finite)

const NumericParameterValuesSchema = Schema.Array(Schema.Number)
type NumericParameterValues = Schema.Schema.Type<typeof NumericParameterValuesSchema>

const PrimitiveParameterValuesSchema = Schema.Array(PrimitiveChoiceSchema)
type PrimitiveParameterValues = Schema.Schema.Type<typeof PrimitiveParameterValuesSchema>

const configValue = valueFromConfig

const asFiniteNumber = (value: unknown): Option.Option<number> => Option.liftPredicate(finiteNumberGuard)(value)

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
  conditions: SearchSpace.ParameterMetadata["activeWhen"]
): boolean => Arr.every(conditions, (condition) => matchesCondition(config, condition))

const conditionFallbackLadder = (
  conditions: SearchSpace.ParameterMetadata["activeWhen"]
) =>
  Arr.makeBy(
    Num.increment(Arr.length(conditions)),
    (index) => Arr.take(conditions, Num.subtract(Arr.length(conditions), index))
  )

const collectValues = <A>(
  parameter: SearchSpace.ParameterMetadata,
  trials: TrialSplit["below"],
  conditions: SearchSpace.ParameterMetadata["activeWhen"],
  normalize: (value: unknown) => Option.Option<A>
) =>
  Arr.flatMap(trials, (trial) =>
    Match.value(matchesAllConditions(trial.config, conditions)).pipe(
      Match.when(true, () =>
        configValue(trial.config, parameter.name).pipe(
          Option.flatMap(normalize),
          Option.match({
            onNone: () => Arr.empty<A>(),
            onSome: Arr.of
          })
        )),
      Match.orElse(() => Arr.empty<A>())
    ))

const valuesWithFallback = <A>(
  parameter: SearchSpace.ParameterMetadata,
  trials: TrialSplit["below"],
  normalize: (value: unknown) => Option.Option<A>
) =>
  Arr.reduce(
    conditionFallbackLadder(parameter.activeWhen),
    Arr.empty<A>(),
    (selected, conditions) =>
      Match.value(Arr.isNonEmptyReadonlyArray(selected)).pipe(
        Match.when(true, () => selected),
        Match.orElse(() => collectValues(parameter, trials, conditions, normalize))
      )
  )

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
  parameter: SearchSpace.ParameterMetadata,
  trials: TrialSplit["below"]
): NumericParameterValues => valuesWithFallback(parameter, trials, asFiniteNumber)

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
  parameter: SearchSpace.ParameterMetadata,
  trials: TrialSplit["below"]
): PrimitiveParameterValues => valuesWithFallback(parameter, trials, asPrimitiveChoice)
