/**
 * Base compiler that transforms flat dimension declarations into validated parameter metadata and a typed schema.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, HashMap, Match, Option, Record, Schema } from "effect"

import type { Categorical, Distribution } from "../../../Distribution.js"
import { fromAST } from "../../../Distribution.js"
import type { InvalidSearchSpace } from "../../../SearchError.js"
import { type Condition, Parameter } from "../../../SearchSpace.js"
import { invalidSearchSpace } from "../failure.js"
import { validateDistribution } from "../validation.js"

const requireDistribution = (
  name: string,
  schema: Schema.Schema.AnyNoContext
): Effect.Effect<Distribution, InvalidSearchSpace> =>
  Option.match(fromAST(schema.ast), {
    onNone: () => Effect.fail(invalidSearchSpace(`dimension "${name}" is missing distribution metadata`, name)),
    onSome: Effect.succeed
  })

const toParameterMetadata = (
  name: string,
  distribution: Distribution,
  activeWhenInput: Iterable<Condition>
): Parameter => {
  const activeWhen = Arr.fromIterable(activeWhenInput)
  return new Parameter({
    name,
    distribution,
    activeWhen
  })
}

const choicesFromDistribution = (distribution: Distribution) =>
  Match.value(distribution).pipe(
    Match.when({ type: "categorical" }, ({ choices }) => Option.some(choices)),
    Match.orElse(() => Option.none())
  )

const mergeCategoricalChoices = (
  parametersInput: Iterable<Parameter>,
  knownChoices: HashMap.HashMap<string, Categorical["choices"]>
) => {
  const parameters = Arr.fromIterable(parametersInput)
  return Arr.reduce(
    parameters,
    knownChoices,
    (lookup, parameter) =>
      Option.match(choicesFromDistribution(parameter.distribution), {
        onNone: () => lookup,
        onSome: (choices) => HashMap.set(lookup, parameter.name, choices)
      })
  )
}

/**
 * Compiles flat dimension declarations into validated parameter metadata, a typed schema, and a categorical choices lookup.
 *
 * @since 0.1.0
 * @category utils
 */
export const compileBase = <
  const Dimensions extends {
    readonly [key: string]: Schema.Schema.AnyNoContext
  }
>(
  dimensions: Dimensions,
  activeWhenInput: Iterable<Condition>
) => {
  const activeWhen = Arr.fromIterable(activeWhenInput)
  return Effect.gen(function*() {
    const entries = Record.toEntries(dimensions)
    const params = yield* Effect.forEach(entries, ([name, dimension]) =>
      requireDistribution(name, dimension).pipe(
        Effect.flatMap((distribution) =>
          validateDistribution(name, distribution).pipe(
            Effect.map(() => toParameterMetadata(name, distribution, activeWhen))
          )
        )
      ))

    return {
      schema: Schema.Struct(dimensions),
      dimensions: HashMap.fromIterable(entries),
      params,
      knownChoices: mergeCategoricalChoices(params, HashMap.empty<string, Categorical["choices"]>())
    }
  })
}
