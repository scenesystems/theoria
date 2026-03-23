import { Effect, Match, Number as Num } from "effect"

import type { Distribution, PrimitiveChoice } from "../../contracts/Distribution.js"
import { GridIncompatible } from "../../Errors/index.js"
import type { FiniteDimension } from "../../internal/grid.js"
import type * as SearchSpace from "../../SearchSpace/index.js"

const floatingEpsilon = 1e-12

const finiteRange = (low: number, high: number, step: number): Array<number> => {
  const go = (cursor: number, acc: Array<number>): Array<number> =>
    Num.greaterThan(cursor, high + floatingEpsilon)
      ? acc
      : go(cursor + step, [...acc, Num.round(cursor, 12)])

  return go(low, [])
}

const finiteValuesFromDistribution = (
  name: string,
  distribution: Distribution
): Effect.Effect<ReadonlyArray<PrimitiveChoice>, GridIncompatible> =>
  Match.value(distribution).pipe(
    Match.when({ type: "categorical" }, ({ choices }) => Effect.succeed(choices)),
    Match.when({ type: "int" }, ({ low, high, step }) =>
      Match.value(step).pipe(
        Match.when(Match.number, (stride) => Effect.succeed(finiteRange(low, high, stride))),
        Match.orElse(() => Effect.succeed(finiteRange(low, high, 1)))
      )),
    Match.when({ type: "fidelity" }, ({ low, high }) => Effect.succeed(finiteRange(low, high, 1))),
    Match.when({ type: "float" }, ({ low, high, step }) =>
      Match.value(step).pipe(
        Match.when(Match.number, (stride) => Effect.succeed(finiteRange(low, high, stride))),
        Match.orElse(() =>
          Effect.fail(
            new GridIncompatible({
              dimension: name,
              reason: "grid sampler requires finite dimensions; float dimensions need a step"
            })
          )
        )
      )),
    Match.exhaustive
  )

const finiteDimensionFromParameter = (
  parameter: SearchSpace.ParameterMetadata
): Effect.Effect<FiniteDimension, GridIncompatible> =>
  finiteValuesFromDistribution(parameter.name, parameter.distribution).pipe(
    Effect.map((values) => ({
      name: parameter.name,
      values: [...values]
    }))
  )

export const finiteDimensionsFromSpace = (
  space: SearchSpace.SearchSpace
): Effect.Effect<Array<FiniteDimension>, GridIncompatible> => Effect.forEach(space.params, finiteDimensionFromParameter)
