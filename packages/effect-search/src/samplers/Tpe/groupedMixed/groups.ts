import { Array as Arr, Data, Match, Number as Num, Predicate, Record } from "effect"

import type { TrialSplit } from "../../../internal/tpe/splitTrials.js"
import * as SearchSpace from "../../../SearchSpace/index.js"
import type { GroupedMixedSettings } from "./model.js"

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

export const isContinuousParameter = (parameter: SearchSpace.ParameterMetadata): boolean =>
  Match.value(parameter.distribution).pipe(
    Match.when({ type: "float" }, () => true),
    Match.when({ type: "int" }, () => true),
    Match.when({ type: "fidelity" }, () => true),
    Match.orElse(() => false)
  )
