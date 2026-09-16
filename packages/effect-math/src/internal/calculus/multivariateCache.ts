/**
 * Immutable cache state for multivariate differentiation kernels.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Data, HashMap, Number, Option } from "effect"
import type { Chunk } from "effect"

/**
 * Stores vector-field evaluations for one Jacobian lifetime.
 *
 * @since 0.1.0
 * @category internal
 */
export class VectorFieldCache extends Data.Class<{
  readonly values: HashMap.HashMap<Chunk.Chunk<number>, Chunk.Chunk<number>>
}> {}

/**
 * Carries a cached value and the immutable cache that contains it.
 *
 * @since 0.1.0
 * @category internal
 */
export class VectorFieldEvaluation extends Data.Class<{
  readonly value: Chunk.Chunk<number>
  readonly cache: VectorFieldCache
}> {}

/**
 * Resolves a vector-field evaluation without mutable closure state.
 *
 * @since 0.1.0
 * @category internal
 */
export const evaluateVectorField = (
  f: (point: Chunk.Chunk<number>) => Chunk.Chunk<number>,
  cache: VectorFieldCache,
  candidate: Chunk.Chunk<number>
): VectorFieldEvaluation =>
  Option.match(HashMap.get(cache.values, candidate), {
    onSome: (value) => new VectorFieldEvaluation({ value, cache }),
    onNone: () => {
      const value = f(candidate)
      return new VectorFieldEvaluation({
        value,
        cache: new VectorFieldCache({ values: HashMap.set(cache.values, candidate, value) })
      })
    }
  })

/**
 * Canonical key for one symmetric mixed-partial pair.
 *
 * @since 0.1.0
 * @category internal
 */
export class MixedPartialKey extends Data.Class<{
  readonly lower: number
  readonly upper: number
}> {}

/**
 * Orders a mixed-partial pair so symmetric Hessian entries share a key.
 *
 * @since 0.1.0
 * @category internal
 */
export const mixedPartialKey = (axisA: number, axisB: number): MixedPartialKey =>
  Boolean.match(Number.lessThan(axisA, axisB), {
    onTrue: () => new MixedPartialKey({ lower: axisA, upper: axisB }),
    onFalse: () => new MixedPartialKey({ lower: axisB, upper: axisA })
  })
