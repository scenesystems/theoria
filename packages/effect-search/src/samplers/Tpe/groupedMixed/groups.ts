/**
 * TPE parameter grouping — conditional decomposition and depth-ordered group construction.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Match, Number as Num, Predicate, Record } from "effect"

import type { TrialSplit } from "../../../internal/tpe/splitTrials.js"
import * as SearchSpace from "../../../SearchSpace/index.js"
import type { GroupedMixedSettings } from "./model.js"

/**
 * A sorted batch of parameter names at a given conditional depth.
 * Groups are sampled sequentially from shallowest to deepest so
 * that discriminant values resolved in earlier groups can gate
 * which parameters are active in later groups.
 *
 * @see {@link orderedGroups} which constructs and sorts these
 * @see {@link activeGroupParameters} which filters by activation
 * @since 0.1.0
 * @category models
 */
export class OrderedGroup extends Data.Class<{
  readonly key: string
  readonly names: ReadonlyArray<string>
  readonly depth: number
}> {}

const namesFromSpace = (space: SearchSpace.SearchSpace): ReadonlyArray<string> =>
  Arr.map(space.params, (parameter) => parameter.name)

const containsName = (names: ReadonlyArray<string>, name: string): boolean => Arr.contains(names, name)

const parametersInGroup = (
  space: SearchSpace.SearchSpace,
  names: ReadonlyArray<string>
): ReadonlyArray<SearchSpace.ParameterMetadata> =>
  Arr.filter(space.params, (parameter) => containsName(names, parameter.name))

const groupDepth = (parameters: ReadonlyArray<SearchSpace.ParameterMetadata>): number =>
  Match.value(parameters.length <= 0).pipe(
    Match.when(true, () => 0),
    Match.orElse(() =>
      Arr.reduce(
        parameters,
        Number.POSITIVE_INFINITY,
        (depth, parameter) => Num.min(depth, parameter.activeWhen.length)
      )
    )
  )

/**
 * Decomposes a search space into depth-sorted parameter groups. When
 * `groupDimensions` is enabled, conditional boundaries define group
 * edges; otherwise all parameters form a single group. Groups are
 * sorted by minimum activation depth so shallow discriminants are
 * resolved before deeper conditional branches.
 *
 * @see {@link OrderedGroup} for the group data model
 * @see {@link GroupedMixedSettings} for the controlling feature flags
 * @since 0.1.0
 * @category constructors
 */
export const orderedGroups = (
  space: SearchSpace.SearchSpace,
  settings: GroupedMixedSettings
): ReadonlyArray<OrderedGroup> => {
  const groups = Match.value(settings.groupDimensions).pipe(
    Match.when(true, () => Arr.map(SearchSpace.decomposeConditionalGroups(space), (group) => [...group.dimensions])),
    Match.orElse(() => [namesFromSpace(space)])
  )

  return Arr.map(groups, (names) => {
    const sortedNames = [...names].sort((left, right) => left.localeCompare(right))
    const parameters = parametersInGroup(space, sortedNames)
    return new OrderedGroup({
      key: sortedNames.join("|"),
      names: sortedNames,
      depth: groupDepth(parameters)
    })
  }).sort((left, right) =>
    left.depth === right.depth
      ? left.key.localeCompare(right.key)
      : left.depth - right.depth
  )
}

/**
 * Filters a group's parameters to only those whose activation
 * conditions are satisfied by the current partial config. Called
 * during sequential group sampling so that conditional branches
 * are correctly pruned before building Parzen estimators.
 *
 * @see {@link OrderedGroup} for the group being filtered
 * @see {@link splitForParameters} for narrowing trial history
 * @since 0.1.0
 * @category sampling
 */
export const activeGroupParameters = (
  space: SearchSpace.SearchSpace,
  group: OrderedGroup,
  partialConfig: unknown
): ReadonlyArray<SearchSpace.ParameterMetadata> =>
  Arr.filter(
    parametersInGroup(space, group.names),
    (parameter) => SearchSpace.isParameterActive(parameter, partialConfig)
  )

const trialContainsAllParameters = (
  config: unknown,
  parameters: ReadonlyArray<SearchSpace.ParameterMetadata>
): boolean =>
  Predicate.isRecord(config)
    ? Arr.every(parameters, (parameter) => Record.has(config, parameter.name))
    : false

/**
 * Narrows a trial split to only trials whose configs contain all of
 * the given parameters. Falls back to the original split if either
 * side would become empty, ensuring Parzen estimators always have
 * sufficient observations to build density models.
 *
 * @see {@link activeGroupParameters} which determines which parameters are live
 * @see {@link suggestGroup} which consumes the narrowed split
 * @since 0.1.0
 * @category sampling
 */
export const splitForParameters = (
  split: TrialSplit,
  parameters: ReadonlyArray<SearchSpace.ParameterMetadata>
): TrialSplit => {
  const below = Arr.filter(split.below, (trial) => trialContainsAllParameters(trial.config, parameters))
  const above = Arr.filter(split.above, (trial) => trialContainsAllParameters(trial.config, parameters))

  return below.length > 0 && above.length > 0
    ? { below, above }
    : split
}

/**
 * Reports whether a parameter has a continuous distribution (float,
 * int, or fidelity). Used to partition group parameters into those
 * eligible for multivariate continuous kernels versus those that
 * must be sampled independently as categoricals.
 *
 * @see {@link suggestGroup} which uses this to route parameters
 * @since 0.1.0
 * @category guards
 */
export const isContinuousParameter = (parameter: SearchSpace.ParameterMetadata): boolean =>
  Match.value(parameter.distribution).pipe(
    Match.when({ type: "float" }, () => true),
    Match.when({ type: "int" }, () => true),
    Match.when({ type: "fidelity" }, () => true),
    Match.orElse(() => false)
  )
