/**
 * Resolves pick and omit projection name sets with dependency closure expansion for conditional search spaces.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Option } from "effect"

import type { InvalidSearchSpace } from "../../Errors/index.js"
import type { ParameterMetadata, SearchSpace as SearchSpaceType } from "../model.js"
import {
  appendUnique,
  knownParameterNames,
  parameterByName,
  projectionFailure,
  type ProjectionOperation,
  uniqueNames
} from "./common.js"

const unknownProjectionNames = (space: SearchSpaceType, names: ReadonlyArray<string>): Array<string> =>
  Arr.filter(names, (name) => !Arr.contains(knownParameterNames(space), name))

const validateProjectionNames = (
  operation: ProjectionOperation,
  space: SearchSpaceType,
  names: ReadonlyArray<string>
): Effect.Effect<Array<string>, InvalidSearchSpace> =>
  Effect.gen(function*() {
    const requested = uniqueNames(names)
    const unknown = unknownProjectionNames(space, requested)

    yield* Effect.filterOrFail(Effect.void, () =>
      unknown.length === 0, () =>
      projectionFailure(operation, `unknown parameter(s): ${unknown.join(", ")}`))

    return requested
  })

const dependencyDimensionsForParameter = (
  operation: ProjectionOperation,
  space: SearchSpaceType,
  name: string
): Effect.Effect<Array<string>, InvalidSearchSpace> =>
  parameterByName(space.params, name).pipe(
    Option.match({
      onNone: () => Effect.fail(projectionFailure(operation, `parameter "${name}" does not exist`, name)),
      onSome: (parameter) => Effect.succeed(Arr.map(parameter.activeWhen, (condition) => condition.dimension))
    })
  )

const expandDependencyClosure = (
  operation: ProjectionOperation,
  space: SearchSpaceType,
  names: ReadonlyArray<string>
): Effect.Effect<Array<string>, InvalidSearchSpace> =>
  Effect.forEach(names, (name) => dependencyDimensionsForParameter(operation, space, name)).pipe(
    Effect.map((dependencySets) =>
      Arr.reduce(
        dependencySets,
        [...names],
        (accumulator, dependencies) =>
          Arr.reduce(dependencies, accumulator, (resolved, dependency) => appendUnique(resolved, dependency))
      )
    )
  )

const dependencyClosure = (
  operation: ProjectionOperation,
  space: SearchSpaceType,
  names: ReadonlyArray<string>
): Effect.Effect<Array<string>, InvalidSearchSpace> =>
  expandDependencyClosure(operation, space, names).pipe(
    Effect.flatMap((expanded) =>
      expanded.length === names.length
        ? Effect.succeed(expanded)
        : dependencyClosure(operation, space, expanded)
    )
  )

const isDescendantOfOmitted = (parameter: ParameterMetadata, omittedNames: ReadonlyArray<string>): boolean =>
  Arr.some(parameter.activeWhen, (condition) => Arr.contains(omittedNames, condition.dimension))

const expandDescendantClosure = (space: SearchSpaceType, omittedNames: ReadonlyArray<string>): Array<string> =>
  Arr.reduce(
    space.params,
    [...omittedNames],
    (accumulator, parameter) =>
      isDescendantOfOmitted(parameter, accumulator)
        ? appendUnique(accumulator, parameter.name)
        : accumulator
  )

const descendantClosure = (space: SearchSpaceType, omittedNames: ReadonlyArray<string>): Array<string> => {
  const expanded = expandDescendantClosure(space, omittedNames)

  return expanded.length === omittedNames.length
    ? expanded
    : descendantClosure(space, expanded)
}

/**
 * Validates and expands pick projection names, following dependency closure to include discriminant parameters.
 *
 * @since 0.1.0
 * @category utils
 */
export const resolvePickProjectionNames = (
  space: SearchSpaceType,
  names: ReadonlyArray<string>
): Effect.Effect<Array<string>, InvalidSearchSpace> =>
  validateProjectionNames("pick", space, names).pipe(
    Effect.filterOrFail(
      (requested) => requested.length > 0,
      () => projectionFailure("pick", "pick requires at least one parameter name")
    ),
    Effect.flatMap((requested) => dependencyClosure("pick", space, requested))
  )

/**
 * Validates and expands omit projection names, cascading removal to descendant parameters.
 *
 * @since 0.1.0
 * @category utils
 */
export const resolveOmitProjectionNames = (
  space: SearchSpaceType,
  names: ReadonlyArray<string>
): Effect.Effect<Array<string>, InvalidSearchSpace> =>
  validateProjectionNames("omit", space, names).pipe(
    Effect.map((requested) => descendantClosure(space, requested)),
    Effect.map((omitted) => Arr.filter(knownParameterNames(space), (name) => !Arr.contains(omitted, name)))
  )
