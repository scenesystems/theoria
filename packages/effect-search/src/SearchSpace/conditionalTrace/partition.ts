/**
 * Trial partitioning by parameter presence and conditional activation.
 *
 * @since 0.1.0
 */
import { Array as Arr, Match, Option, Record } from "effect"

import { isParameterActive } from "../activity.js"
import type { ParameterMetadata, SearchSpace } from "../model.js"
import type { ConditionalTraceTrial } from "./model.js"
import { ConditionalTracePartition } from "./model.js"

const findParameter = (space: SearchSpace, name: string): Option.Option<ParameterMetadata> =>
  Arr.findFirst(space.params, (parameter) => parameter.name === name)

const resolveRequiredParameters = (
  space: SearchSpace,
  requiredParams: ReadonlyArray<string>
): Option.Option<Array<ParameterMetadata>> =>
  Arr.reduce(
    requiredParams,
    Option.some<Array<ParameterMetadata>>([]),
    (resolved, name) =>
      Option.flatMap(resolved, (parameters) =>
        findParameter(space, name).pipe(
          Option.map((parameter) => Arr.append(parameters, parameter))
        ))
  )

const includesParameter = (trial: ConditionalTraceTrial, name: string): boolean => Record.has(trial.params, name)

const includesRequiredParameters = (
  trial: ConditionalTraceTrial,
  requiredParameters: ReadonlyArray<ParameterMetadata>
): boolean =>
  Arr.every(
    requiredParameters,
    (parameter) => isParameterActive(parameter, trial.params) && includesParameter(trial, parameter.name)
  )

const excludedOnlyPartition = (trials: ReadonlyArray<ConditionalTraceTrial>): ConditionalTracePartition =>
  new ConditionalTracePartition({
    included: [],
    excluded: Arr.map(trials, (trial) => trial.trialNumber)
  })

const partitionByParameters = (
  trials: ReadonlyArray<ConditionalTraceTrial>,
  requiredParameters: ReadonlyArray<ParameterMetadata>
): ConditionalTracePartition =>
  Arr.reduce(
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
  requiredParams: ReadonlyArray<string>,
  trials: ReadonlyArray<ConditionalTraceTrial>
): ConditionalTracePartition =>
  resolveRequiredParameters(space, requiredParams).pipe(
    Option.match({
      onNone: () => excludedOnlyPartition(trials),
      onSome: (requiredParameters) => partitionByParameters(trials, requiredParameters)
    })
  )
