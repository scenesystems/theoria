/**
 * Dense vector kernels over Chunk carriers using Effect primitives.
 *
 * @since 0.1.0
 * @category internal
 */
import { Chunk, Number as N, pipe } from "effect"

/**
 * Absolute value via `Number.negate` and `Number.max`.
 *
 * @since 0.1.0
 * @category internal
 */
const abs = (x: number): number => N.max(x, N.negate(x))

/**
 * Dot product of two equal-length chunks via `Chunk.zipWith` + `Chunk.reduce`.
 *
 * @since 0.1.0
 * @category internal
 */
export const dot = (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>): number =>
  pipe(
    Chunk.zipWith(a, b, N.multiply),
    Chunk.reduce(0, N.sum)
  )

/**
 * Euclidean (L2) norm via dot product with self and `Math.sqrt`.
 *
 * `Math.sqrt` is a deterministic IEEE 754 primitive — no Effect equivalent
 * exists. Used here as a leaf mathematical operation.
 *
 * @since 0.1.0
 * @category internal
 */
export const normL2 = (v: Chunk.Chunk<number>): number => Math.sqrt(dot(v, v))

/**
 * L1 norm (sum of absolute values) via `Chunk.reduce`.
 *
 * @since 0.1.0
 * @category internal
 */
export const normL1 = (v: Chunk.Chunk<number>): number => Chunk.reduce(v, 0, (acc, x) => N.sum(acc, abs(x)))

/**
 * Infinity norm (maximum absolute value) via `Chunk.reduce` + `Number.max`.
 *
 * @since 0.1.0
 * @category internal
 */
export const normLinf = (v: Chunk.Chunk<number>): number => Chunk.reduce(v, 0, (acc, x) => N.max(acc, abs(x)))

/**
 * Elementwise vector addition via `Chunk.zipWith` + `Number.sum`.
 *
 * @since 0.1.0
 * @category internal
 */
export const add = (
  a: Chunk.Chunk<number>,
  b: Chunk.Chunk<number>
): Chunk.Chunk<number> => Chunk.zipWith(a, b, N.sum)

/**
 * Scalar-vector multiplication via `Chunk.map` + `Number.multiply`.
 *
 * @since 0.1.0
 * @category internal
 */
export const scale = (
  alpha: number,
  v: Chunk.Chunk<number>
): Chunk.Chunk<number> => Chunk.map(v, (x) => N.multiply(alpha, x))
