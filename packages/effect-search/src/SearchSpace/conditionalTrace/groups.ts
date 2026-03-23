/**
 * Decomposes conditional search spaces into canonical independent dimension groups for per-group sampling.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Match, Option, Record } from "effect"

import type { ParameterMetadata, SearchSpace } from "../model.js"
import { ConditionalGroup } from "./model.js"

const conditionalGroupKey = (parameter: ParameterMetadata): string =>
  Arr.head(parameter.activeWhen).pipe(
    Option.match({
      onNone: () => "",
      onSome: (condition) => `${condition.dimension}:${String(condition.equals)}`
    })
  )

const discriminantFromGroupedParameters = (parameters: ReadonlyArray<ParameterMetadata>): string =>
  Arr.findFirst(parameters, (parameter) => parameter.activeWhen.length > 0).pipe(
    Option.flatMap((parameter) => Arr.head(parameter.activeWhen)),
    Option.match({
      onNone: () => "",
      onSome: (condition) => condition.dimension
    })
  )

const rootDimensions = (space: SearchSpace): Array<string> =>
  Arr.filter(space.params, (parameter) => parameter.activeWhen.length === 0).map((parameter) => parameter.name)

const emptyDimensions = (): Array<string> => []

const emptyGroupDimensions = (): Array<Array<string>> => []

const uniqueDimensions = (dimensions: ReadonlyArray<string>): Array<string> =>
  Arr.reduce(
    dimensions,
    emptyDimensions(),
    (accumulator, dimension) =>
      Arr.contains(accumulator, dimension)
        ? accumulator
        : Arr.append(accumulator, dimension)
  )

const intersectDimensions = (
  left: ReadonlyArray<string>,
  right: ReadonlyArray<string>
): Array<string> => Arr.filter(left, (value) => Arr.contains(right, value))

const excludeDimensions = (
  left: ReadonlyArray<string>,
  right: ReadonlyArray<string>
): Array<string> => Arr.filter(left, (value) => !Arr.contains(right, value))

const branchAdditions = (space: SearchSpace): Array<Array<string>> => {
  const grouped = Arr.groupBy(
    Arr.filter(space.params, (parameter) => parameter.activeWhen.length > 0),
    conditionalGroupKey
  )

  return Record.toEntries(grouped)
    .filter(([key]) => key.length > 0)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([_key, parameters]) => {
      const discriminant = discriminantFromGroupedParameters(parameters)
      return uniqueDimensions([discriminant, ...Arr.map(parameters, (parameter) => parameter.name)])
    })
    .filter((addition) => addition.length > 0)
}

const conditionalAdditions = (space: SearchSpace): Array<Array<string>> => {
  const root = uniqueDimensions(rootDimensions(space))
  const branches = branchAdditions(space)

  return root.length > 0
    ? [root, ...branches]
    : branches
}

class DecompositionState extends Data.Class<{
  readonly groups: Array<Array<string>>
  readonly remaining: Array<string>
}> {}

const splitByAddition = (
  groups: ReadonlyArray<ReadonlyArray<string>>,
  addition: ReadonlyArray<string>
): Array<Array<string>> => {
  const initialState = new DecompositionState({
    groups: emptyGroupDimensions(),
    remaining: uniqueDimensions(addition)
  })

  const reduced = Arr.reduce(
    groups,
    initialState,
    (state, group) => {
      const overlap = intersectDimensions(group, state.remaining)
      const groupOnly = excludeDimensions(group, state.remaining)
      const nextGroups = [
        ...state.groups,
        ...Match.value(overlap.length > 0).pipe(
          Match.when(true, () => [overlap]),
          Match.orElse(() => emptyGroupDimensions())
        ),
        ...Match.value(groupOnly.length > 0).pipe(
          Match.when(true, () => [groupOnly]),
          Match.orElse(() => emptyGroupDimensions())
        )
      ]

      return new DecompositionState({
        groups: nextGroups,
        remaining: excludeDimensions(state.remaining, group)
      })
    }
  )

  return reduced.remaining.length > 0
    ? [...reduced.groups, reduced.remaining]
    : reduced.groups
}

const decomposedGroups = (additions: ReadonlyArray<ReadonlyArray<string>>): Array<Array<string>> =>
  Arr.reduce(
    additions,
    emptyGroupDimensions(),
    (groups, addition) => splitByAddition(groups, addition)
  )

const canonicalConditionalGroups = (
  groups: ReadonlyArray<ReadonlyArray<string>>
): Array<ConditionalGroup> =>
  Arr.map(groups, (dimensions) => uniqueDimensions(dimensions).sort((left, right) => left.localeCompare(right)))
    .sort((left, right) => left.join("|").localeCompare(right.join("|")))
    .map((dimensions) =>
      new ConditionalGroup({
        key: dimensions.join("|"),
        dimensions
      })
    )

/**
 * Decompose a conditional search space into canonical independent groups.
 *
 * @since 0.1.0
 * @category utils
 */
export const decomposeConditionalGroups = (space: SearchSpace): Array<ConditionalGroup> =>
  canonicalConditionalGroups(decomposedGroups(conditionalAdditions(space)))
