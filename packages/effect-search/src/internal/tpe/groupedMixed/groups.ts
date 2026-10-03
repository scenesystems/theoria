/**
 * TPE parameter grouping — conditional decomposition and depth-ordered group construction.
 *
 * @since 0.1.0
 */
import { Array as Arr, Boolean as Bool, Chunk, Data, Match, Number as Num, Order, Predicate, Record } from "effect"

import type { TrialSplit } from "../../../internal/tpe/splitTrials.js"
import * as SearchSpace from "../../../SearchSpace.js"
import type { GroupedMixedSettings } from "../groupedMixed.js"

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
  readonly names: Chunk.Chunk<string>
  readonly depth: number
}> {}

const namesFromSpace = (space: SearchSpace.SearchSpace) => Arr.map(space.params, (parameter) => parameter.name)

const containsName = (namesInput: Iterable<string>, name: string): boolean => {
  const names = Arr.fromIterable(namesInput)
  return Arr.contains(names, name)
}

const parametersInGroup = (
  space: SearchSpace.SearchSpace,
  namesInput: Iterable<string>
) => {
  const names = Arr.fromIterable(namesInput)
  return Arr.filter(space.params, (parameter) => containsName(names, parameter.name))
}

const groupDepth = (parametersInput: Iterable<SearchSpace.Parameter>): number => {
  const parameters = Arr.fromIterable(parametersInput)
  return Match.value(Num.isLessThanOrEqualTo(Arr.length(parameters), 0)).pipe(
    Match.when(true, () => 0),
    Match.orElse(() =>
      Arr.reduce(
        parameters,
        Number.POSITIVE_INFINITY,
        (depth, parameter) => Num.min(depth, Arr.length(parameter.activeWhen))
      )
    )
  )
}

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
) => {
  const groups = Match.value(settings.groupDimensions).pipe(
    Match.when(
      true,
      () => Arr.map(SearchSpace.decomposeConditionalGroups(space), (group) => Arr.fromIterable(group.dimensions))
    ),
    Match.orElse(() => Arr.of(namesFromSpace(space)))
  )

  const ordered = Arr.map(groups, (names) => {
    const sortedNames = Arr.sort(names, Order.String)
    const parameters = parametersInGroup(space, sortedNames)
    return new OrderedGroup({
      key: Arr.join(sortedNames, "|"),
      names: Chunk.fromIterable(sortedNames),
      depth: groupDepth(parameters)
    })
  })

  const sortedByKey = Arr.sort(ordered, Order.mapInput(Order.String, (group: OrderedGroup) => group.key))
  return Arr.sort(sortedByKey, Order.mapInput(Order.Number, (group: OrderedGroup) => group.depth))
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
) =>
  Arr.filter(
    parametersInGroup(space, group.names),
    (parameter) => SearchSpace.isParameterActive(parameter, partialConfig)
  )

const trialContainsAllParameters = (
  config: unknown,
  parametersInput: Iterable<SearchSpace.Parameter>
): boolean => {
  const parameters = Arr.fromIterable(parametersInput)
  return Match.value(config).pipe(
    Match.when(
      Predicate.isObject,
      (record) => Arr.every(parameters, (parameter) => Record.has(record, parameter.name))
    ),
    Match.orElse(() => false)
  )
}

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
  parametersInput: Iterable<SearchSpace.Parameter>
): TrialSplit => {
  const parameters = Arr.fromIterable(parametersInput)

  const below = Arr.filter(split.below, (trial) => trialContainsAllParameters(trial.config, parameters))
  const above = Arr.filter(split.above, (trial) => trialContainsAllParameters(trial.config, parameters))

  return Match.value(Bool.and(Num.isGreaterThan(Arr.length(below), 0), Num.isGreaterThan(Arr.length(above), 0))).pipe(
    Match.when(true, () => ({ below, above })),
    Match.orElse(() => split)
  )
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
export const isContinuousParameter = (parameter: SearchSpace.Parameter): boolean =>
  Match.value(parameter.distribution).pipe(
    Match.when({ type: "float" }, () => true),
    Match.when({ type: "int" }, () => true),
    Match.when({ type: "fidelity" }, () => true),
    Match.orElse(() => false)
  )
