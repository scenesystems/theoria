/**
 * Base compiler that transforms flat dimension declarations into validated parameter metadata and a typed schema.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, HashMap, Match, Option, Record, Schema } from "effect"

import type { Distribution, PrimitiveChoice } from "../../contracts/Distribution.js"
import { readDistribution } from "../../contracts/Distribution.js"
import type { InvalidSearchSpace } from "../../Errors/index.js"
import { invalidSearchSpace } from "../failure.js"
import type { ActivationCondition, ParameterMetadata } from "../model.js"
import { ParameterMetadata as ParameterMetadataClass } from "../model.js"
import { validateDistribution } from "../validation.js"

const requireDistribution = (
  name: string,
  schema: Schema.Schema.AnyNoContext
): Effect.Effect<Distribution, InvalidSearchSpace> =>
  Option.match(readDistribution(schema.ast), {
    onNone: () => Effect.fail(invalidSearchSpace(`dimension "${name}" is missing distribution metadata`, name)),
    onSome: Effect.succeed
  })

const toParameterMetadata = (
  name: string,
  distribution: Distribution,
  activeWhen: Array<ActivationCondition>
): ParameterMetadata =>
  new ParameterMetadataClass({
    name,
    distribution,
    activeWhen: [...activeWhen]
  })

const choicesFromDistribution = (distribution: Distribution): Option.Option<ReadonlyArray<PrimitiveChoice>> =>
  Match.value(distribution).pipe(
    Match.when({ type: "categorical" }, ({ choices }) => Option.some(choices)),
    Match.orElse(() => Option.none())
  )

const mergeCategoricalChoices = (
  parameters: Array<ParameterMetadata>,
  knownChoices: HashMap.HashMap<string, ReadonlyArray<PrimitiveChoice>>
): HashMap.HashMap<string, ReadonlyArray<PrimitiveChoice>> =>
  Arr.reduce(
    parameters,
    knownChoices,
    (lookup, parameter) =>
      Option.match(choicesFromDistribution(parameter.distribution), {
        onNone: () => lookup,
        onSome: (choices) => HashMap.set(lookup, parameter.name, choices)
      })
  )

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
  activeWhen: Array<ActivationCondition>
): Effect.Effect<{
  readonly schema: Schema.Struct<Dimensions>
  readonly dimensions: HashMap.HashMap<string, Schema.Struct.Field>
  readonly params: Array<ParameterMetadata>
  readonly knownChoices: HashMap.HashMap<string, ReadonlyArray<PrimitiveChoice>>
}, InvalidSearchSpace> =>
  Effect.gen(function*() {
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
      knownChoices: mergeCategoricalChoices(params, HashMap.empty<string, ReadonlyArray<PrimitiveChoice>>())
    }
  })
