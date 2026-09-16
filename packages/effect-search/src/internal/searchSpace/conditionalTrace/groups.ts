/**
 * Conditional dimension grouping for per-group sampler models.
 *
 * @since 0.1.0
 */
import { Array as Arr, Boolean as Bool, Data, Match, Number as Num, Option, Order, Record, Schema } from "effect"

import { ConditionalGroup, type Parameter, type SearchSpace } from "../../../SearchSpace.js"

const Dimensions = Schema.Array(Schema.String)
const DimensionGroups = Schema.Array(Dimensions)

const conditionalGroupKey = (parameter: Parameter): string =>
  Arr.head(parameter.activeWhen).pipe(
    Option.match({
      onNone: () => "",
      onSome: (condition) => `${condition.dimension}:${String(condition.equals)}`
    })
  )

const discriminantFromGroupedParameters = (parametersInput: Iterable<Parameter>): string => {
  const parameters = Arr.fromIterable(parametersInput)
  return Arr.findFirst(parameters, (parameter) => Num.greaterThan(parameter.activeWhen.length, 0)).pipe(
    Option.flatMap((parameter) => Arr.head(parameter.activeWhen)),
    Option.match({
      onNone: () => "",
      onSome: (condition) => condition.dimension
    })
  )
}

const rootDimensions = (space: SearchSpace) =>
  Arr.map(
    Arr.filter(space.params, (parameter) => Num.Equivalence(parameter.activeWhen.length, 0)),
    (parameter) => parameter.name
  )

const emptyDimensions = () => Arr.empty<string>()

const emptyGroupDimensions = () => Arr.empty<typeof Dimensions.Type>()

const uniqueDimensions = (dimensionsInput: Iterable<string>) => {
  const dimensions = Arr.fromIterable(dimensionsInput)
  return Arr.reduce(
    dimensions,
    emptyDimensions(),
    (accumulator, dimension) =>
      Match.value(Arr.contains(accumulator, dimension)).pipe(
        Match.when(true, () => accumulator),
        Match.orElse(() => Arr.append(accumulator, dimension))
      )
  )
}

const intersectDimensions = (
  leftInput: Iterable<string>,
  rightInput: Iterable<string>
) => {
  const left = Arr.fromIterable(leftInput)
  const right = Arr.fromIterable(rightInput)
  return Arr.filter(left, (value) => Arr.contains(right, value))
}

const excludeDimensions = (
  leftInput: Iterable<string>,
  rightInput: Iterable<string>
) => {
  const left = Arr.fromIterable(leftInput)
  const right = Arr.fromIterable(rightInput)
  return Arr.filter(left, (value) => Bool.not(Arr.contains(right, value)))
}

const branchAdditions = (space: SearchSpace) => {
  const grouped = Arr.groupBy(
    Arr.filter(space.params, (parameter) => Num.greaterThan(parameter.activeWhen.length, 0)),
    conditionalGroupKey
  )

  const nonEmptyGroups = Arr.filter(Record.toEntries(grouped), ([key]) => Num.greaterThan(key.length, 0))
  const groupedParameterOrder: Order.Order<(typeof nonEmptyGroups)[number]> = Order.mapInput(
    Order.string,
    ([key]) => key
  )
  const orderedGroups = Arr.sort(nonEmptyGroups, groupedParameterOrder)
  const additions = Arr.map(orderedGroups, ([_key, parameters]) => {
    const discriminant = discriminantFromGroupedParameters(parameters)
    return uniqueDimensions([discriminant, ...Arr.map(parameters, (parameter) => parameter.name)])
  })

  return Arr.filter(additions, (addition) => Num.greaterThan(addition.length, 0))
}

const conditionalAdditions = (space: SearchSpace) => {
  const root = uniqueDimensions(rootDimensions(space))
  const branches = branchAdditions(space)

  return Match.value(Num.greaterThan(root.length, 0)).pipe(
    Match.when(true, () => Arr.prepend(branches, root)),
    Match.orElse(() => branches)
  )
}

class DecompositionState extends Data.Class<{
  readonly groups: typeof DimensionGroups.Type
  readonly remaining: typeof Dimensions.Type
}> {}

const splitByAddition = (
  groupsInput: Iterable<typeof Dimensions.Type>,
  additionInput: Iterable<string>
) => {
  const groups = Arr.fromIterable(groupsInput)
  const addition = Arr.fromIterable(additionInput)

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
        ...Match.value(Num.greaterThan(overlap.length, 0)).pipe(
          Match.when(true, () => [overlap]),
          Match.orElse(() => emptyGroupDimensions())
        ),
        ...Match.value(Num.greaterThan(groupOnly.length, 0)).pipe(
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

  return Match.value(Num.greaterThan(reduced.remaining.length, 0)).pipe(
    Match.when(true, () => Arr.append(reduced.groups, reduced.remaining)),
    Match.orElse(() => Arr.fromIterable(reduced.groups))
  )
}

const decomposedGroups = (additionsInput: Iterable<typeof Dimensions.Type>) => {
  const additions = Arr.fromIterable(additionsInput)
  return Arr.reduce(
    additions,
    emptyGroupDimensions(),
    (groups, addition) => splitByAddition(groups, addition)
  )
}

const canonicalConditionalGroups = (
  groupsInput: Iterable<typeof Dimensions.Type>
) => {
  const groups = Arr.fromIterable(groupsInput)
  return Arr.map(
    Arr.sortBy(Order.mapInput(Order.string, (dimensionsInput: Iterable<string>) => {
      const dimensions = Arr.fromIterable(dimensionsInput)
      return Arr.join(dimensions, "|")
    }))(
      Arr.map(groups, (dimensions) => Arr.sort(uniqueDimensions(dimensions), Order.string))
    ),
    (dimensions) =>
      new ConditionalGroup({
        key: Arr.join(dimensions, "|"),
        dimensions
      })
  )
}

/**
 * Partitions dimensions according to overlap among root and branch additions.
 *
 * @remarks
 * Each first-level branch contributes its discriminant and parameters; nested
 * parameters remain associated with their outermost condition. Repeated names
 * are removed. Dimensions within a group and the groups themselves use lexical
 * order, and each key joins its dimension names with `"|"`. An empty space
 * produces no groups.
 *
 * @param space - Compiled metadata whose activation paths are decomposed.
 *
 * @since 0.1.0
 * @category combinators
 */
export const decomposeConditionalGroups = (space: SearchSpace) =>
  canonicalConditionalGroups(decomposedGroups(conditionalAdditions(space)))
