/**
 * Finite dimension extraction — converts search space parameters into discrete value sets for grid enumeration.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Match, Number as Num, Schema } from "effect"

import type { Distribution } from "../../../Distribution.js"
import { GridIncompatible } from "../../../SearchError.js"
import type * as SearchSpace from "../../../SearchSpace.js"
import type { FiniteDimension } from "../../grid.js"

const floatingEpsilon = 1e-12
const NumericValues = Schema.Array(Schema.Number)
type NumericValues = typeof NumericValues.Type

const finiteRange = (low: number, high: number, step: number) => {
  const go = (cursor: number, acc: NumericValues): NumericValues =>
    Match.value(Num.greaterThan(cursor, Num.sum(high, floatingEpsilon))).pipe(
      Match.when(true, () => acc),
      Match.orElse(() => go(Num.sum(cursor, step), Arr.append(acc, Num.round(cursor, 12))))
    )

  return go(low, Arr.empty<number>())
}

const finiteValuesFromDistribution = (
  name: string,
  distribution: Distribution
) =>
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
  parameter: SearchSpace.Parameter
): Effect.Effect<FiniteDimension, GridIncompatible> =>
  finiteValuesFromDistribution(parameter.name, parameter.distribution).pipe(
    Effect.map((values) => ({
      name: parameter.name,
      values: Arr.fromIterable(values)
    }))
  )

/**
 * Extracts finite, enumerable value sets from every search space parameter,
 * failing for unbounded float dimensions that lack a step size.
 *
 * The resulting dimension arrays are combined via Cartesian product to
 * form the full grid of configurations.
 *
 * @see {@link configAtCursor} for accessing individual grid entries
 * @since 0.1.0
 * @category constructors
 */
export const finiteDimensionsFromSpace = (
  space: SearchSpace.SearchSpace
) => Effect.forEach(space.params, finiteDimensionFromParameter)
