/**
 * Dense vector kernels over Chunk carriers using Effect primitives.
 *
 * @since 0.1.0
 * @category internal
 */
import { Array, Chunk, Number } from "effect"

import { abs, hypot } from "../../Numeric.js"

/**
 * Dot product over the shared prefix of two chunks.
 *
 * @since 0.1.0
 * @category internal
 */
export const dot = (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>): number => {
  const transientB = Chunk.toReadonlyArray(b)
  return Chunk.reduce(
    Chunk.take(a, Number.min(Chunk.size(a), Chunk.size(b))),
    0,
    (sum, value, index) =>
      Number.sum(
        sum,
        Number.multiply(value, Array.unsafeGet(transientB, index))
      )
  )
}

/**
 * Euclidean (L2) norm via Numeric's overflow-safe hypot kernel.
 *
 * @since 0.1.0
 * @category internal
 */
export const normL2 = (v: Chunk.Chunk<number>): number => hypot(v)

/**
 * L1 norm (sum of absolute values) via `Chunk.reduce`.
 *
 * @since 0.1.0
 * @category internal
 */
export const normL1 = (v: Chunk.Chunk<number>): number => Chunk.reduce(v, 0, (acc, x) => Number.sum(acc, abs(x)))

/**
 * Infinity norm (maximum absolute value) via `Chunk.reduce` + `Number.max`.
 *
 * @since 0.1.0
 * @category internal
 */
export const normLinf = (v: Chunk.Chunk<number>): number => Chunk.reduce(v, 0, (acc, x) => Number.max(acc, abs(x)))

/**
 * Elementwise vector addition via `Chunk.zipWith` + `Number.sum`.
 *
 * @since 0.1.0
 * @category internal
 */
export const add = (
  a: Chunk.Chunk<number>,
  b: Chunk.Chunk<number>
): Chunk.Chunk<number> => Chunk.zipWith(a, b, Number.sum)

/**
 * Scalar-vector multiplication via `Chunk.map` + `Number.multiply`.
 *
 * @since 0.1.0
 * @category internal
 */
export const scale = (
  alpha: number,
  v: Chunk.Chunk<number>
): Chunk.Chunk<number> => Chunk.map(v, (x) => Number.multiply(alpha, x))
