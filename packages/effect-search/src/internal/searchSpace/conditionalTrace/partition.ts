/**
 * Trial partitioning by parameter presence and conditional activation.
 *
 * @since 0.1.0
 */
import { Array as Arr, Boolean as Bool, Equal, Match, Option, Record } from "effect"

import {
  ConditionalTracePartition,
  type ConditionalTraceTrial,
  type Parameter,
  type SearchSpace
} from "../../../SearchSpace.js"
import { isParameterActive } from "../activity.js"

const findParameter = (space: SearchSpace, name: string): Option.Option<Parameter> =>
  Arr.findFirst(space.params, (parameter) => Equal.equals(parameter.name, name))

const resolveRequiredParameters = (
  space: SearchSpace,
  requiredParamsInput: Iterable<string>
) => {
  const requiredParams = Arr.fromIterable(requiredParamsInput)
  return Arr.reduce(
    requiredParams,
    Option.some<SearchSpace["params"]>([]),
    (resolved, name) =>
      Option.flatMap(resolved, (parameters) =>
        findParameter(space, name).pipe(
          Option.map((parameter) => Arr.append(parameters, parameter))
        ))
  )
}

const includesParameter = (trial: ConditionalTraceTrial, name: string): boolean => Record.has(trial.params, name)

const includesRequiredParameters = (
  trial: ConditionalTraceTrial,
  requiredParametersInput: Iterable<Parameter>
): boolean => {
  const requiredParameters = Arr.fromIterable(requiredParametersInput)
  return Arr.every(
    requiredParameters,
    (parameter) => Bool.and(isParameterActive(parameter, trial.params), includesParameter(trial, parameter.name))
  )
}

const excludedOnlyPartition = (trialsInput: Iterable<ConditionalTraceTrial>): ConditionalTracePartition => {
  const trials = Arr.fromIterable(trialsInput)
  return new ConditionalTracePartition({
    included: [],
    excluded: Arr.map(trials, (trial) => trial.trialNumber)
  })
}

const partitionByParameters = (
  trialsInput: Iterable<ConditionalTraceTrial>,
  requiredParametersInput: Iterable<Parameter>
): ConditionalTracePartition => {
  const trials = Arr.fromIterable(trialsInput)
  const requiredParameters = Arr.fromIterable(requiredParametersInput)
  return Arr.reduce(
    trials,
    new ConditionalTracePartition({ included: [], excluded: [] }),
    (partition, trial) =>
      Match.value(includesRequiredParameters(trial, requiredParameters)).pipe(
        Match.when(
          true,
          () =>
            new ConditionalTracePartition({
              included: Arr.append(partition.included, trial.trialNumber),
              excluded: partition.excluded
            })
        ),
        Match.orElse(() =>
          new ConditionalTracePartition({
            included: partition.included,
            excluded: Arr.append(partition.excluded, trial.trialNumber)
          })
        )
      )
  )
}

/**
 * Separates trial identities by the availability of required active parameters.
 *
 * @remarks
 * A trial is included only when every requested name exists in the space, is
 * active for that trial's primitive parameters, and is present in the trial.
 * Input order is preserved in both arrays. An unknown required name excludes all
 * trials; an empty required list includes all trials.
 *
 * @param space - Compiled metadata used to resolve names and activation paths.
 * @param requiredParams - Parameter names that must be active and present.
 * @param trials - Primitive trial records to partition in input order.
 *
 * @since 0.1.0
 * @category combinators
 */
export const partitionTrialNumbersByRequiredParameters = (
  space: SearchSpace,
  requiredParamsInput: Iterable<string>,
  trialsInput: Iterable<ConditionalTraceTrial>
): ConditionalTracePartition => {
  const requiredParams = Arr.fromIterable(requiredParamsInput)
  const trials = Arr.fromIterable(trialsInput)
  return resolveRequiredParameters(space, requiredParams).pipe(
    Option.match({
      onNone: () => excludedOnlyPartition(trials),
      onSome: (requiredParameters) => partitionByParameters(trials, requiredParameters)
    })
  )
}
