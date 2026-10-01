/**
 * Dense matrix kernels over Chunk carriers with shape metadata.
 *
 * Row-major layout: element (i, j) lives at offset + i * stride + j.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Chunk, Iterable, Number, Option, pipe, Tuple } from "effect"

import { hypot } from "../../Numeric.js"

const indices = (size: number): Chunk.Chunk<number> =>
  Chunk.fromIterable(
    Iterable.unfold(0, (index) =>
      Boolean.match(Number.lessThan(index, size), {
        onFalse: Option.none,
        onTrue: () => Option.some(Tuple.make(index, Number.increment(index)))
      }))
  )

/**
 * Read element (i, j) from a row-major chunk with stride/offset.
 * Returns `Option.none()` for out-of-bounds access.
 *
 * @since 0.1.0
 * @category internal
 */
export const getElement = (
  data: Chunk.Chunk<number>,
  stride: number,
  offset: number,
  i: number,
  j: number
): Option.Option<number> => Chunk.get(data, Number.sum(offset, Number.sum(Number.multiply(i, stride), j)))

/**
 * Read element (i, j) from a row-major chunk, defaulting to 0.
 *
 * @since 0.1.0
 * @category internal
 */
const getOr0 = (
  data: Chunk.Chunk<number>,
  stride: number,
  offset: number,
  i: number,
  j: number
): number => Option.getOrElse(getElement(data, stride, offset, i, j), () => 0)

/**
 * Matrix-vector multiply: y = A * x.
 *
 * @since 0.1.0
 * @category internal
 */
export const matvec = (
  data: Chunk.Chunk<number>,
  rows: number,
  cols: number,
  stride: number,
  offset: number,
  x: Chunk.Chunk<number>
): Chunk.Chunk<number> =>
  Chunk.map(indices(rows), (i) =>
    Chunk.reduce(
      Chunk.map(indices(cols), (j) =>
        Number.multiply(
          getOr0(data, stride, offset, i, j),
          Option.getOrElse(Chunk.get(x, j), () => 0)
        )),
      0,
      Number.sum
    ))

/**
 * Matrix transpose: returns new chunk with transposed layout.
 *
 * @since 0.1.0
 * @category internal
 */
export const transpose = (
  data: Chunk.Chunk<number>,
  rows: number,
  cols: number,
  stride: number,
  offset: number
): Chunk.Chunk<number> =>
  pipe(
    Chunk.map(indices(cols), (j) => Chunk.map(indices(rows), (i) => getOr0(data, stride, offset, i, j))),
    Chunk.flatMap((row) => row)
  )

/**
 * Frobenius norm of a matrix.
 *
 * @since 0.1.0
 * @category internal
 */
export const frobeniusNorm = (
  data: Chunk.Chunk<number>,
  rows: number,
  cols: number,
  stride: number,
  offset: number
): number =>
  hypot(
    Chunk.flatMap(
      indices(rows),
      (i) => Chunk.map(indices(cols), (j) => getOr0(data, stride, offset, i, j))
    )
  )
