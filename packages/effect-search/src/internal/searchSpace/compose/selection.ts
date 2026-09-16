/**
 * Resolves pick and omit projection name sets with dependency closure expansion for conditional search spaces.
 *
 * @since 0.1.0
 */
import { Array as Arr, Boolean as Bool, Effect, Equal, Match, Number as Num, Option, Schema } from "effect"

import type { InvalidSearchSpace } from "../../../SearchError.js"
import type { Parameter, SearchSpace as SearchSpaceType } from "../../../SearchSpace.js"
import {
  appendUnique,
  knownParameterNames,
  parameterByName,
  projectionFailure,
  type ProjectionOperation,
  uniqueNames
} from "./common.js"

const Names = Schema.Array(Schema.String)
type Names = typeof Names.Type

const unknownProjectionNames = (space: SearchSpaceType, namesInput: Iterable<string>) => {
  const names = Arr.fromIterable(namesInput)
  return Arr.filter(names, (name) => Bool.not(Arr.contains(knownParameterNames(space), name)))
}

const validateProjectionNames = (
  operation: ProjectionOperation,
  space: SearchSpaceType,
  namesInput: Iterable<string>
) => {
  const names = Arr.fromIterable(namesInput)
  return Effect.gen(function*() {
    const requested = uniqueNames(names)
    const unknown = unknownProjectionNames(space, requested)

    yield* Effect.filterOrFail(
      Effect.void,
      () => Num.Equivalence(unknown.length, 0),
      () => projectionFailure(operation, `unknown parameter(s): ${Arr.join(unknown, ", ")}`)
    )

    return requested
  })
}

const dependencyDimensionsForParameter = (
  operation: ProjectionOperation,
  space: SearchSpaceType,
  name: string
) =>
  parameterByName(space.params, name).pipe(
    Option.match({
      onNone: () => Effect.fail(projectionFailure(operation, `parameter "${name}" does not exist`, name)),
      onSome: (parameter) => Effect.succeed(Arr.map(parameter.activeWhen, (condition) => condition.dimension))
    })
  )

const expandDependencyClosure = (
  operation: ProjectionOperation,
  space: SearchSpaceType,
  namesInput: Iterable<string>
) => {
  const names = Arr.fromIterable(namesInput)
  return Effect.forEach(names, (name) => dependencyDimensionsForParameter(operation, space, name)).pipe(
    Effect.map((dependencySets) =>
      Arr.reduce(
        dependencySets,
        Arr.fromIterable(names),
        (accumulator, dependencies) =>
          Arr.reduce(dependencies, accumulator, (resolved, dependency) => appendUnique(resolved, dependency))
      )
    )
  )
}

const dependencyClosure = (
  operation: ProjectionOperation,
  space: SearchSpaceType,
  namesInput: Iterable<string>
): Effect.Effect<Names, InvalidSearchSpace> => {
  const names = Arr.fromIterable(namesInput)
  return expandDependencyClosure(operation, space, names).pipe(
    Effect.filterOrElse(
      (expanded) => Equal.equals(expanded.length, names.length),
      (expanded) => dependencyClosure(operation, space, expanded)
    )
  )
}

const isDescendantOfOmitted = (parameter: Parameter, omittedNamesInput: Iterable<string>): boolean => {
  const omittedNames = Arr.fromIterable(omittedNamesInput)
  return Arr.some(parameter.activeWhen, (condition) => Arr.contains(omittedNames, condition.dimension))
}

const expandDescendantClosure = (space: SearchSpaceType, omittedNamesInput: Iterable<string>) => {
  const omittedNames = Arr.fromIterable(omittedNamesInput)
  return Arr.reduce(
    space.params,
    Arr.fromIterable(omittedNames),
    (accumulator, parameter) =>
      Match.value(isDescendantOfOmitted(parameter, accumulator)).pipe(
        Match.when(true, () => appendUnique(accumulator, parameter.name)),
        Match.orElse(() => accumulator)
      )
  )
}

const descendantClosure = (space: SearchSpaceType, omittedNamesInput: Iterable<string>): Names => {
  const omittedNames = Arr.fromIterable(omittedNamesInput)

  const expanded = expandDescendantClosure(space, omittedNames)

  return Match.value(Equal.equals(expanded.length, omittedNames.length)).pipe(
    Match.when(true, () => expanded),
    Match.orElse(() => descendantClosure(space, expanded))
  )
}

/**
 * Validates and expands pick projection names, following dependency closure to include discriminant parameters.
 *
 * @since 0.1.0
 * @category utils
 */
export const resolvePickProjectionNames = (
  space: SearchSpaceType,
  namesInput: Iterable<string>
) => {
  const names = Arr.fromIterable(namesInput)
  return validateProjectionNames("pick", space, names).pipe(
    Effect.filterOrFail(
      (requested) => Num.greaterThan(requested.length, 0),
      () => projectionFailure("pick", "pick requires at least one parameter name")
    ),
    Effect.flatMap((requested) => dependencyClosure("pick", space, requested))
  )
}

/**
 * Validates and expands omit projection names, cascading removal to descendant parameters.
 *
 * @since 0.1.0
 * @category utils
 */
export const resolveOmitProjectionNames = (
  space: SearchSpaceType,
  namesInput: Iterable<string>
) => {
  const names = Arr.fromIterable(namesInput)
  return validateProjectionNames("omit", space, names).pipe(
    Effect.map((requested) => descendantClosure(space, requested)),
    Effect.map((omitted) => Arr.filter(knownParameterNames(space), (name) => Bool.not(Arr.contains(omitted, name))))
  )
}
