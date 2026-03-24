/**
 * Shared utilities for search space composition including projection helpers, unique name resolution, and parameter lookup.
 *
 * @since 0.1.0
 */
import type { Option } from "effect"
import { Array as Arr } from "effect"

import type { InvalidSearchSpace } from "../../Errors/index.js"
import { invalidSearchSpace } from "../failure.js"
import type { ParameterMetadata, SearchSpace as SearchSpaceType } from "../model.js"

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
export const appendUnique = (names: ReadonlyArray<string>, value: string): Array<string> =>
  Arr.contains(names, value)
    ? [...names]
    : Arr.append(names, value)

const emptyNames = (): Array<string> => []

/**
 * Deduplicates a name array while preserving first-occurrence order.
 *
 * @since 0.1.0
 * @category utils
 */
export const uniqueNames = (names: ReadonlyArray<string>): Array<string> =>
  Arr.reduce(names, emptyNames(), (accumulator, name) => appendUnique(accumulator, name))

/**
 * Extracts all parameter names declared in a search space.
 *
 * @since 0.1.0
 * @category utils
 */
export const knownParameterNames = (space: SearchSpaceType): Array<string> =>
  Arr.map(space.params, (parameter) => parameter.name)

/**
 * Looks up a parameter by name, returning None if not found.
 *
 * @since 0.1.0
 * @category utils
 */
export const parameterByName = (
  parameters: ReadonlyArray<ParameterMetadata>,
  name: string
): Option.Option<ParameterMetadata> => Arr.findFirst(parameters, (parameter) => parameter.name === name)
