/**
 * Numeric reduction kernels.
 *
 * @since 0.1.0
 * @category internal
 */
import { Chunk, Number as EffectNumber } from "effect"
import * as Arr from "effect/Array"

/**
 * Sum over any `Iterable<number>` via `Number.sumAll`.
 *
 * @since 0.1.0
 * @category internal
 */
export const sumScalar: (values: Iterable<number>) => number = EffectNumber.sumAll

/**
 * Kahan-compensated sum over a `Float64Array` carrier via `Array.reduce`.
 *
 * @since 0.1.0
 * @category internal
 */
export const sumTypedArray = (values: Float64Array): number => {
  const { s } = Arr.reduce(
    Arr.fromIterable(values),
    { s: 0, c: 0 },
    (acc, v) => {
      const y = v - acc.c
      const t = acc.s + y
      return { s: t, c: (t - acc.s) - y }
    }
  )
  return s
}

/**
 * Sum over a `Chunk<number>` via `Number.sumAll`.
 *
 * @since 0.1.0
 * @category internal
 */
export const sumChunk = (values: Chunk.Chunk<number>): number => EffectNumber.sumAll(Chunk.toReadonlyArray(values))

/**
 * Kahan-compensated sum of natural logs over a `Float64Array` carrier.
 *
 * @since 0.1.0
 * @category internal
 */
export const sumLogTypedArray = (values: Float64Array): number => {
  const { s } = Arr.reduce(
    Arr.fromIterable(values),
    { s: 0, c: 0 },
    (acc, v) => {
      const y = Math.log(v) - acc.c
      const t = acc.s + y
      return { s: t, c: (t - acc.s) - y }
    }
  )
  return s
}
