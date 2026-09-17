/**
 * Dense matrix kernels over Chunk carriers with shape metadata.
 *
 * Row-major layout: element (i, j) lives at offset + i * stride + j.
 *
 * @since 0.1.0
 * @category internal
 */
import { Array, Boolean, Chunk, Number, type Option } from "effect"

import { ceil, floor, hypot } from "../../Numeric.js"

const indices = (size: number): Chunk.Chunk<number> =>
  Boolean.match(Number.greaterThan(size, 0), {
    onFalse: Chunk.empty,
    onTrue: () => Chunk.makeBy(ceil(size), (index) => index)
  })

const elementCount = (rows: number, cols: number): number =>
  Boolean.match(Boolean.and(Number.greaterThan(rows, 0), Number.greaterThan(cols, 0)), {
    onFalse: () => 0,
    onTrue: () => Number.multiply(ceil(rows), ceil(cols))
  })

const transientValueAt = (
  data: ReadonlyArray<number>,
  index: number
): number =>
  Boolean.match(
    Boolean.and(
      Number.greaterThanOrEqualTo(index, 0),
      Number.lessThan(index, Array.length(data))
    ),
    {
      onFalse: () => 0,
      onTrue: () => Array.unsafeGet(data, index)
    }
  )

const hasDenseRegion = (
  data: ReadonlyArray<number>,
  rows: number,
  cols: number,
  stride: number,
  offset: number
): boolean =>
  Boolean.and(
    Number.greaterThan(rows, 0),
    Boolean.and(
      Number.greaterThan(cols, 0),
      Boolean.and(
        Number.greaterThanOrEqualTo(offset, 0),
        Boolean.and(
          Number.greaterThanOrEqualTo(stride, cols),
          Number.lessThanOrEqualTo(
            Number.sum(
              offset,
              Number.sum(Number.multiply(Number.decrement(rows), stride), cols)
            ),
            Array.length(data)
          )
        )
      )
    )
  )

const transientReader = (
  data: ReadonlyArray<number>,
  complete: boolean
): (index: number) => number =>
  Boolean.match(complete, {
    onFalse: () => (index) => transientValueAt(data, index),
    onTrue: () => (index) => Array.unsafeGet(data, index)
  })

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
): Chunk.Chunk<number> => {
  const transientData = Chunk.toReadonlyArray(data)
  const transientX = Chunk.toReadonlyArray(x)
  const columnIndices = indices(cols)
  const dataAt = transientReader(transientData, hasDenseRegion(transientData, rows, cols, stride, offset))
  const xAt = transientReader(
    transientX,
    Boolean.and(Number.greaterThan(cols, 0), Number.lessThanOrEqualTo(cols, Array.length(transientX)))
  )
  return Chunk.map(indices(rows), (i) =>
    Chunk.reduce(columnIndices, 0, (sum, j) =>
      Number.sum(
        sum,
        Number.multiply(
          dataAt(Number.sum(offset, Number.sum(Number.multiply(i, stride), j))),
          xAt(j)
        )
      )))
}

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
): Chunk.Chunk<number> => {
  const transientData = Chunk.toReadonlyArray(data)
  const dataAt = transientReader(transientData, hasDenseRegion(transientData, rows, cols, stride, offset))
  const rowCount = ceil(rows)
  return Chunk.map(indices(elementCount(rows, cols)), (flatIndex) => {
    const sourceColumn = floor(Number.unsafeDivide(flatIndex, rowCount))
    const sourceRow = Number.subtract(flatIndex, Number.multiply(sourceColumn, rowCount))
    return dataAt(
      Number.sum(offset, Number.sum(Number.multiply(sourceRow, stride), sourceColumn))
    )
  })
}

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
): number => {
  const transientData = Chunk.toReadonlyArray(data)
  const dataAt = transientReader(transientData, hasDenseRegion(transientData, rows, cols, stride, offset))
  const columnCount = ceil(cols)
  return hypot(
    Chunk.map(indices(elementCount(rows, cols)), (flatIndex) => {
      const row = floor(Number.unsafeDivide(flatIndex, columnCount))
      const column = Number.subtract(flatIndex, Number.multiply(row, columnCount))
      return dataAt(
        Number.sum(offset, Number.sum(Number.multiply(row, stride), column))
      )
    })
  )
}
