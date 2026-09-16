/**
 * Shared utilities for search space composition including projection helpers, unique name resolution, and parameter lookup.
 *
 * @since 0.1.0
 */
import type { Option } from "effect"
import { Array as Arr, Equal, Match } from "effect"

import type { InvalidSearchSpace } from "../../../SearchError.js"
import type { Parameter, SearchSpace as SearchSpaceType } from "../../../SearchSpace.js"
import { invalidSearchSpace } from "../failure.js"

/**
 * @since 0.1.0
 * @category type-level
 */
export type ProjectionOperation = "pick" | "omit"

/**
 * Constructs an InvalidSearchSpace error scoped to a pick or omit projection operation.
 *
 * @since 0.1.0
 * @category constructors
 */
export const projectionFailure = (
  operation: ProjectionOperation,
  reason: string,
  dimension?: string
): InvalidSearchSpace => invalidSearchSpace(`SearchSpace.${operation}: ${reason}`, dimension)

/**
 * Appends a name to an array only if it is not already present.
 *
 * @since 0.1.0
 * @category utils
 */
export const appendUnique = (namesInput: Iterable<string>, value: string) => {
  const names = Arr.fromIterable(namesInput)
  return Match.value(Arr.contains(names, value)).pipe(
    Match.when(true, () => Arr.fromIterable(names)),
    Match.orElse(() => Arr.append(names, value))
  )
}

const emptyNames = () => Arr.empty<string>()

/**
 * Deduplicates a name array while preserving first-occurrence order.
 *
 * @since 0.1.0
 * @category utils
 */
export const uniqueNames = (namesInput: Iterable<string>) => {
  const names = Arr.fromIterable(namesInput)
  return Arr.reduce(names, emptyNames(), (accumulator, name) => appendUnique(accumulator, name))
}

/**
 * Extracts all parameter names declared in a search space.
 *
 * @since 0.1.0
 * @category utils
 */
export const knownParameterNames = (space: SearchSpaceType) => Arr.map(space.params, (parameter) => parameter.name)

/**
 * Looks up a parameter by name, returning None if not found.
 *
 * @since 0.1.0
 * @category utils
 */
export const parameterByName = (
  parametersInput: Iterable<Parameter>,
  name: string
): Option.Option<Parameter> => {
  const parameters = Arr.fromIterable(parametersInput)
  return Arr.findFirst(parameters, (parameter) => Equal.equals(parameter.name, name))
}
