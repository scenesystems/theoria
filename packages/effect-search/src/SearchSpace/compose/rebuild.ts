/**
 * Rebuilds a projected search space from filtered parameter metadata, reconstructing schemas and conditional branches.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Equal, Match, Option, Schema } from "effect"

import {
  annotateDistribution,
  type Distribution,
  type PrimitiveChoice,
  PrimitiveChoiceSchema
} from "../../contracts/Distribution.js"
import type { InvalidSearchSpace } from "../../Errors/index.js"
import { make, makeConditional } from "../compile.js"
import { ActivationCondition, type ParameterMetadata, type SearchSpace as SearchSpaceType } from "../model.js"
import { switchOn, when } from "../switch.js"
import { parameterByName, projectionFailure, type ProjectionOperation } from "./common.js"

type ConditionPath = ReadonlyArray<ActivationCondition>

const conditionEquals = (left: ActivationCondition, right: ActivationCondition): boolean =>
  left.dimension === right.dimension && Equal.equals(left.equals, right.equals)

const pathStartsWith = (path: ConditionPath, prefix: ConditionPath): boolean =>
  Arr.every(prefix, (condition, index) =>
    Arr.get(path, index).pipe(
      Option.match({
        onNone: () => false,
        onSome: (candidate) => conditionEquals(candidate, condition)
      })
    ))

const pathEquals = (left: ConditionPath, right: ConditionPath): boolean =>
  left.length === right.length && pathStartsWith(left, right)

const parametersAtPath = (
  parameters: ReadonlyArray<ParameterMetadata>,
  path: ConditionPath
): Array<ParameterMetadata> => Arr.filter(parameters, (parameter) => pathEquals(parameter.activeWhen, path))

const parametersBelowPath = (
  parameters: ReadonlyArray<ParameterMetadata>,
  path: ConditionPath
): Array<ParameterMetadata> =>
  Arr.filter(
    parameters,
    (parameter) => parameter.activeWhen.length > path.length && pathStartsWith(parameter.activeWhen, path)
  )

const emptyDiscriminants = (): Array<string> => []

const nextDiscriminantsForPath = (
  parameters: ReadonlyArray<ParameterMetadata>,
  path: ConditionPath
): Array<string> =>
  Arr.reduce(
    Arr.filterMap(parametersBelowPath(parameters, path), (parameter) =>
      Arr.get(parameter.activeWhen, path.length).pipe(Option.map((condition) => condition.dimension))),
    emptyDiscriminants(),
    (accumulator, discriminant) =>
      Arr.contains(accumulator, discriminant)
        ? accumulator
        : Arr.append(accumulator, discriminant)
  )

const requireParameter = (
  operation: ProjectionOperation,
  parameters: ReadonlyArray<ParameterMetadata>,
  name: string
): Effect.Effect<ParameterMetadata, InvalidSearchSpace> =>
  parameterByName(parameters, name).pipe(
    Option.match({
      onNone: () =>
        Effect.fail(
          projectionFailure(operation, `dangling activation dependency on missing discriminant "${name}"`, name)
        ),
      onSome: Effect.succeed
    })
  )

const requireCategoricalChoices = (
  operation: ProjectionOperation,
  parameter: ParameterMetadata
): Effect.Effect<ReadonlyArray<PrimitiveChoice>, InvalidSearchSpace> =>
  Match.value(parameter.distribution).pipe(
    Match.when({ type: "categorical" }, ({ choices }) =>
      Effect.filterOrFail(
        Effect.succeed(choices),
        (values) => values.length > 0,
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
  annotateDistribution(
    PrimitiveChoiceSchema.pipe(
      Schema.filter((value) =>
        Arr.some(distribution.choices, (choice) => Equal.equals(choice, value)) ||
        `categorical value must be one of: ${distribution.choices.join(", ")}`
      )
    ),
    distribution
  )

const schemaFromDistribution = (distribution: Distribution): Schema.Schema.AnyNoContext =>
  Match.value(distribution).pipe(
    Match.when({ type: "float" }, (resolvedDistribution) => annotateDistribution(Schema.Number, resolvedDistribution)),
    Match.when({ type: "int" }, (resolvedDistribution) => annotateDistribution(Schema.Int, resolvedDistribution)),
    Match.when({ type: "fidelity" }, (resolvedDistribution) => annotateDistribution(Schema.Int, resolvedDistribution)),
    Match.when({ type: "categorical" }, (resolvedDistribution) => schemaFromCategoricalChoices(resolvedDistribution)),
    Match.exhaustive
  )

const declarationsFromParameters = (
  parameters: ReadonlyArray<ParameterMetadata>
): Record<string, Schema.Schema.AnyNoContext> =>
  Arr.reduce(
    parameters,
    {},
    (declarations, parameter) => ({
      ...declarations,
      [parameter.name]: schemaFromDistribution(parameter.distribution)
    })
  )

const buildProjectedSpaceAtPath = (
  operation: ProjectionOperation,
  parameters: ReadonlyArray<ParameterMetadata>,
  path: ConditionPath
): Effect.Effect<SearchSpaceType, InvalidSearchSpace> =>
  Effect.gen(function*() {
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
                  Arr.append(path, new ActivationCondition({ dimension: discriminant, equals: choice }))
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
                onNonEmpty: (head, tail) => Effect.succeed(switchOn(discriminant, [head, ...tail]))
              })

              return yield* makeConditional(declarations, conditionalSwitch)
            })
        })),
      Match.orElse(() =>
        Effect.fail(
          projectionFailure(
            operation,
            `projection introduces multiple independent discriminants at one activation path: ${
              nextDiscriminants.join(", ")
            }`
          )
        )
      )
    )
  })

const failOnDanglingDependencies = (
  operation: ProjectionOperation,
  projectedNames: ReadonlyArray<string>,
  projectedParameters: ReadonlyArray<ParameterMetadata>
): Effect.Effect<void, InvalidSearchSpace> => {
  const dangling = Arr.findFirst(
    projectedParameters,
    (parameter) => Arr.some(parameter.activeWhen, (condition) => !Arr.contains(projectedNames, condition.dimension))
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
  space: SearchSpaceType,
  projectedNames: ReadonlyArray<string>
): Effect.Effect<SearchSpaceType, InvalidSearchSpace> => {
  const projectedParameters = Arr.filter(space.params, (parameter) => Arr.contains(projectedNames, parameter.name))

  return failOnDanglingDependencies(operation, projectedNames, projectedParameters).pipe(
    Effect.flatMap(() => buildProjectedSpaceAtPath(operation, projectedParameters, []))
  )
}
