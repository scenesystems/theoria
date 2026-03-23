/**
 * Dense matrix kernels over Chunk carriers with shape metadata.
 *
 * Row-major layout: element (i, j) lives at offset + i * stride + j.
 *
 * @since 0.1.0
 * @category internal
 */
import { Chunk, Number as N, Option, pipe } from "effect"

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
): Option.Option<number> => Chunk.get(data, N.sum(offset, N.sum(N.multiply(i, stride), j)))

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
  pipe(
    Chunk.makeBy(rows, (i) =>
      Chunk.reduce(
        Chunk.makeBy(cols, (j) =>
          N.multiply(
            getOr0(data, stride, offset, i, j),
            Option.getOrElse(Chunk.get(x, j), () => 0)
          )),
        0,
        N.sum
      ))
  )

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
    Chunk.makeBy(cols, (j) => Chunk.makeBy(rows, (i) => getOr0(data, stride, offset, i, j))),
    Chunk.flatMap((row) => row)
  )

/**
 * Frobenius norm of a matrix.
 *
 * `Math.sqrt` is a deterministic IEEE 754 primitive.
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
  Math.sqrt(
    Chunk.reduce(
      Chunk.makeBy(rows, (i) =>
        Chunk.reduce(
          Chunk.makeBy(cols, (j) => {
            const v = getOr0(data, stride, offset, i, j)
            return N.multiply(v, v)
          }),
          0,
          N.sum
        )),
      0,
      N.sum
    )
  )
