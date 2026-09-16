/**
 * Rebuilds a projected search space from filtered parameter metadata, reconstructing schemas and conditional branches.
 *
 * @since 0.1.0
 */
import { Array as Arr, Boolean as Bool, Chunk, Effect, Equal, Match, Number as Num, Option, Schema } from "effect"

import { annotate, Choice, type Distribution } from "../../../Distribution.js"
import type { InvalidSearchSpace } from "../../../SearchError.js"
import { Condition, type Parameter, type SearchSpace } from "../../../SearchSpace.js"
import { make, makeConditional } from "../compile.js"
import { switchOn, when } from "../switch.js"
import { parameterByName } from "./parameters.js"
import { projectionFailure, type ProjectionOperation } from "./projection.js"

type ConditionPath = Parameter["activeWhen"]

const conditionEquals = (left: Condition, right: Condition): boolean =>
  Bool.and(Equal.equals(left.dimension, right.dimension), Equal.equals(left.equals, right.equals))

const pathStartsWith = (path: ConditionPath, prefix: ConditionPath): boolean =>
  Arr.every(prefix, (condition, index) =>
    Arr.get(path, index).pipe(
      Option.match({
        onNone: () => false,
        onSome: (candidate) => conditionEquals(candidate, condition)
      })
    ))

const pathEquals = (left: ConditionPath, right: ConditionPath): boolean =>
  Bool.and(Equal.equals(left.length, right.length), pathStartsWith(left, right))

const parametersAtPath = (
  parametersInput: Iterable<Parameter>,
  path: ConditionPath
) => {
  const parameters = Arr.fromIterable(parametersInput)
  return Arr.filter(parameters, (parameter) => pathEquals(parameter.activeWhen, path))
}

const parametersBelowPath = (
  parametersInput: Iterable<Parameter>,
  path: ConditionPath
) => {
  const parameters = Arr.fromIterable(parametersInput)
  return Arr.filter(
    parameters,
    (parameter) =>
      Bool.and(
        Num.greaterThan(parameter.activeWhen.length, path.length),
        pathStartsWith(parameter.activeWhen, path)
      )
  )
}

const nextDiscriminantsForPath = (
  parametersInput: Iterable<Parameter>,
  path: ConditionPath
) => {
  const parameters = Arr.fromIterable(parametersInput)
  return Arr.dedupe(
    Arr.filterMap(
      parametersBelowPath(parameters, path),
      (parameter) => Arr.get(parameter.activeWhen, path.length).pipe(Option.map((condition) => condition.dimension))
    )
  )
}

const requireParameter = (
  operation: ProjectionOperation,
  parametersInput: Iterable<Parameter>,
  name: string
): Effect.Effect<Parameter, InvalidSearchSpace> => {
  const parameters = Arr.fromIterable(parametersInput)
  return parameterByName(parameters, name).pipe(
    Option.match({
      onNone: () =>
        Effect.fail(
          projectionFailure(operation, `dangling activation dependency on missing discriminant "${name}"`, name)
        ),
      onSome: Effect.succeed
    })
  )
}

const requireCategoricalChoices = (
  operation: ProjectionOperation,
  parameter: Parameter
) =>
  Match.value(parameter.distribution).pipe(
    Match.when({ type: "categorical" }, ({ choices }) =>
      Effect.filterOrFail(
        Effect.succeed(choices),
        (values) => Num.greaterThan(values.length, 0),
        () =>
          projectionFailure(operation, `discriminant "${parameter.name}" has no categorical choices`, parameter.name)
      )),
    Match.orElse(() =>
      Effect.fail(
        projectionFailure(
          operation,
          `conditional discriminant "${parameter.name}" must be categorical after projection`,
          parameter.name
        )
      )
    )
  )

const schemaFromCategoricalChoices = (
  distribution: Distribution & { readonly type: "categorical" }
): Schema.Schema.AnyNoContext =>
  annotate(
    Choice.pipe(
      Schema.filter((value) =>
        Match.value(Arr.some(distribution.choices, (choice) => Equal.equals(choice, value))).pipe(
          Match.when(true, () => true),
          Match.orElse(() =>
            `categorical value must be one of: ${
              Arr.join(Arr.map(distribution.choices, (choice) => `${choice}`), ", ")
            }`
          )
        )
      )
    ),
    distribution
  )

const schemaFromDistribution = (distribution: Distribution): Schema.Schema.AnyNoContext =>
  Match.value(distribution).pipe(
    Match.when({ type: "float" }, (resolvedDistribution) => annotate(Schema.Number, resolvedDistribution)),
    Match.when({ type: "int" }, (resolvedDistribution) => annotate(Schema.Int, resolvedDistribution)),
    Match.when({ type: "fidelity" }, (resolvedDistribution) => annotate(Schema.Int, resolvedDistribution)),
    Match.when({ type: "categorical" }, (resolvedDistribution) => schemaFromCategoricalChoices(resolvedDistribution)),
    Match.exhaustive
  )

const declarationsFromParameters = (
  parametersInput: Iterable<Parameter>
): Record<string, Schema.Schema.AnyNoContext> => {
  const parameters = Arr.fromIterable(parametersInput)
  return Arr.reduce(
    parameters,
    {},
    (declarations, parameter) => ({
      ...declarations,
      [parameter.name]: schemaFromDistribution(parameter.distribution)
    })
  )
}

const buildProjectedSpaceAtPath = (
  operation: ProjectionOperation,
  parametersInput: Iterable<Parameter>,
  path: ConditionPath
): Effect.Effect<SearchSpace, InvalidSearchSpace> => {
  const parameters = Arr.fromIterable(parametersInput)
  return Effect.gen(function*() {
    const localParameters = parametersAtPath(parameters, path)
    const declarations = declarationsFromParameters(localParameters)
    const nextDiscriminants = nextDiscriminantsForPath(parameters, path)

    return yield* Match.value(nextDiscriminants.length).pipe(
      Match.when(0, () => make(declarations)),
      Match.when(1, () =>
        Arr.matchLeft(nextDiscriminants, {
          onEmpty: () =>
            Effect.fail(
              projectionFailure(operation, "unexpected empty discriminant set while building conditional projection")
            ),
          onNonEmpty: (discriminant) =>
            Effect.gen(function*() {
              const discriminantParameter = yield* requireParameter(operation, localParameters, discriminant)
              const choices = yield* requireCategoricalChoices(operation, discriminantParameter)
              const cases = yield* Effect.forEach(choices, (choice) =>
                buildProjectedSpaceAtPath(
                  operation,
                  parameters,
                  Arr.append(path, new Condition({ dimension: discriminant, equals: choice }))
                ).pipe(Effect.map((branchSpace) => when(choice, branchSpace))))

              const conditionalSwitch = yield* Arr.matchLeft(cases, {
                onEmpty: () =>
                  Effect.fail(
                    projectionFailure(
                      operation,
                      `discriminant "${discriminant}" produced no branch cases`,
                      discriminant
                    )
                  ),
                onNonEmpty: (head, tail) =>
                  Effect.succeed(switchOn(discriminant, Chunk.prepend(Chunk.fromIterable(tail), head)))
              })

              return yield* makeConditional(declarations, conditionalSwitch)
            })
        })),
      Match.orElse(() =>
        Effect.fail(
          projectionFailure(
            operation,
            `projection introduces multiple independent discriminants at one activation path: ${
              Arr.join(nextDiscriminants, ", ")
            }`
          )
        )
      )
    )
  })
}

const failOnDanglingDependencies = (
  operation: ProjectionOperation,
  projectedNamesInput: Iterable<string>,
  projectedParametersInput: Iterable<Parameter>
): Effect.Effect<void, InvalidSearchSpace> => {
  const projectedNames = Arr.fromIterable(projectedNamesInput)
  const projectedParameters = Arr.fromIterable(projectedParametersInput)

  const dangling = Arr.findFirst(
    projectedParameters,
    (parameter) =>
      Arr.some(parameter.activeWhen, (condition) => Bool.not(Arr.contains(projectedNames, condition.dimension)))
  )

  return Option.match(dangling, {
    onNone: () => Effect.void,
    onSome: (parameter) =>
      Effect.fail(
        projectionFailure(
          operation,
          `projection leaves parameter "${parameter.name}" with unresolved activation dependencies`,
          parameter.name
        )
      )
  })
}

/**
 * Rebuilds a projected search space from a subset of parameter names, reconstructing schemas and conditional branches.
 *
 * @since 0.1.0
 * @category utils
 */
export const projectByNames = (
  operation: ProjectionOperation,
  space: SearchSpace,
  projectedNamesInput: Iterable<string>
): Effect.Effect<SearchSpace, InvalidSearchSpace> => {
  const projectedNames = Arr.fromIterable(projectedNamesInput)

  const projectedParameters = Arr.filter(space.params, (parameter) => Arr.contains(projectedNames, parameter.name))

  return failOnDanglingDependencies(operation, projectedNames, projectedParameters).pipe(
    Effect.flatMap(() => buildProjectedSpaceAtPath(operation, projectedParameters, []))
  )
}
