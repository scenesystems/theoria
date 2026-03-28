/**
 * Cache helpers for multivariate differentiation kernels.
 *
 * @since 0.1.0
 * @category internal
 */
import { Chunk, HashMap, Number as N, Option } from "effect"

const pointCacheKey = (point: Chunk.Chunk<number>): string =>
  Chunk.reduce(point, "", (acc, value, index) => N.Equivalence(index, 0) ? String(value) : `${acc}|${String(value)}`)

export const memoizeVectorField = (f: (point: Chunk.Chunk<number>) => Chunk.Chunk<number>) => {
  const state = { cache: HashMap.empty<string, Chunk.Chunk<number>>() }

  return (candidate: Chunk.Chunk<number>) => {
    const key = pointCacheKey(candidate)

    return Option.getOrElse(HashMap.get(state.cache, key), () => {
      const computed = f(candidate)
      state.cache = HashMap.set(state.cache, key, computed)
      return computed
    })
  }
}

export const mixedPartialKey = (axisA: number, axisB: number): string =>
  N.lessThan(axisA, axisB) ? `${axisA}|${axisB}` : `${axisB}|${axisA}`
