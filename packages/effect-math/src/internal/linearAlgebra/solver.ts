/**
 * Dense linear-system kernels for symmetric positive-definite matrices.
 *
 * @since 0.1.0
 * @category internal
 */
import { Array, Boolean, Chunk, Number, Option, Tuple } from "effect"

import { abs, ceil, sqrt } from "../../Numeric.js"

const solverEpsilon = 1e-12

const arrayIndices = (size: number): ReadonlyArray<number> =>
  Boolean.match(Number.greaterThan(size, 0), {
    onFalse: Array.empty,
    onTrue: () => Array.makeBy(ceil(size), (index) => index)
  })

const matrixIndex = (size: number, row: number, column: number): number =>
  Number.sum(Number.multiply(row, size), column)

const matrixValueAt = (
  matrix: ReadonlyArray<number>,
  size: number,
  row: number,
  column: number
): number => Array.unsafeGet(matrix, matrixIndex(size, row, column))

export const choleskySpd = (
  matrix: Chunk.Chunk<number>,
  size: number
): Option.Option<Chunk.Chunk<number>> => {
  const transientMatrix = Chunk.toReadonlyArray(matrix)
  return Option.liftPredicate(matrix, () => Number.greaterThan(size, 0)).pipe(
    Option.filter(() => Number.Equivalence(Chunk.size(matrix), Number.multiply(size, size))),
    Option.flatMap(() => {
      const rowCount = ceil(size)
      return Array.reduce(
        arrayIndices(rowCount),
        Option.some(Array.empty<ReadonlyArray<number>>()),
        (completedRowsOption, row) =>
          Option.flatMap(completedRowsOption, (completedRows) =>
            Array.reduce(
              completedRows,
              Option.some(Array.empty<number>()),
              (partialRowOption, columnFactors, column) =>
                partialRowOption.pipe(
                  Option.filter(() =>
                    Number.lessThanOrEqualTo(
                      abs(Number.subtract(
                        matrixValueAt(transientMatrix, size, row, column),
                        matrixValueAt(transientMatrix, size, column, row)
                      )),
                      solverEpsilon
                    )
                  ),
                  Option.flatMap((partialRow) => {
                    const projection = Array.reduce(
                      partialRow,
                      0,
                      (sum, factor, shared) =>
                        Number.sum(sum, Number.multiply(factor, Array.unsafeGet(columnFactors, shared)))
                    )
                    return Option.liftPredicate(
                      Array.unsafeGet(columnFactors, column),
                      (pivot) => Number.greaterThan(abs(pivot), solverEpsilon)
                    ).pipe(
                      Option.map((pivot) =>
                        Array.append(
                          partialRow,
                          Number.unsafeDivide(
                            Number.subtract(matrixValueAt(transientMatrix, size, row, column), projection),
                            pivot
                          )
                        )
                      )
                    )
                  })
                )
            ).pipe(
              Option.flatMap((partialRow) => {
                const projection = Array.reduce(
                  partialRow,
                  0,
                  (sum, factor) => Number.sum(sum, Number.multiply(factor, factor))
                )
                return Option.liftPredicate(
                  Number.subtract(matrixValueAt(transientMatrix, size, row, row), projection),
                  Number.greaterThan(solverEpsilon)
                ).pipe(
                  Option.map((diagonal) => Array.append(completedRows, Array.append(partialRow, sqrt(diagonal))))
                )
              })
            ))
      ).pipe(
        Option.map((lowerRows) =>
          Chunk.unsafeFromArray(
            Array.flatMap(lowerRows, (row) =>
              Boolean.match(Number.lessThan(Array.length(row), rowCount), {
                onTrue: () => Array.appendAll(row, Array.replicate(0, Number.subtract(rowCount, Array.length(row)))),
                onFalse: () => row
              }))
          )
        )
      )
    })
  )
}

export const forwardSubstituteLower = (
  lower: Chunk.Chunk<number>,
  size: number,
  rhs: Chunk.Chunk<number>
): Option.Option<Chunk.Chunk<number>> =>
  Option.liftPredicate(
    Tuple.make(lower, rhs),
    () =>
      Boolean.and(
        Number.Equivalence(Chunk.size(lower), Number.multiply(size, size)),
        Number.Equivalence(Chunk.size(rhs), size)
      )
  ).pipe(
    Option.flatMap(() => {
      const transientLower = Chunk.toReadonlyArray(lower)
      const transientRhs = Chunk.toReadonlyArray(rhs)
      return Array.reduce(
        arrayIndices(size),
        Option.some(Array.empty<number>()),
        (solvedOption, index) =>
          Option.flatMap(solvedOption, (solved) => {
            const rowStart = Number.multiply(index, size)
            const projection = Array.reduce(
              solved,
              0,
              (sum, value, column) =>
                Number.sum(
                  sum,
                  Number.multiply(
                    Array.unsafeGet(transientLower, Number.sum(rowStart, column)),
                    value
                  )
                )
            )
            return Option.liftPredicate(
              matrixValueAt(transientLower, size, index, index),
              (diagonal) => Number.greaterThan(abs(diagonal), solverEpsilon)
            ).pipe(
              Option.map((diagonal) =>
                Array.append(
                  solved,
                  Number.unsafeDivide(
                    Number.subtract(Array.unsafeGet(transientRhs, index), projection),
                    diagonal
                  )
                )
              )
            )
          })
      ).pipe(Option.map(Chunk.unsafeFromArray))
    })
  )

const backwardSubstitute = (
  upper: ReadonlyArray<number>,
  size: number,
  rhs: ReadonlyArray<number>,
  valueAt: (matrix: ReadonlyArray<number>, size: number, row: number, column: number) => number
): Option.Option<Chunk.Chunk<number>> =>
  Array.reduceRight(
    arrayIndices(size),
    Option.some(Array.empty<number>()),
    (solvedOption, index) =>
      Option.flatMap(solvedOption, (solved) => {
        const columnStart = Number.increment(index)
        const projection = Array.reduce(
          solved,
          0,
          (sum, value, columnOffset) =>
            Number.sum(
              sum,
              Number.multiply(
                valueAt(upper, size, index, Number.sum(columnStart, columnOffset)),
                value
              )
            )
        )
        return Option.liftPredicate(
          valueAt(upper, size, index, index),
          (diagonal) => Number.greaterThan(abs(diagonal), solverEpsilon)
        ).pipe(
          Option.map((diagonal) =>
            Array.prepend(
              solved,
              Number.unsafeDivide(
                Number.subtract(Array.unsafeGet(rhs, index), projection),
                diagonal
              )
            )
          )
        )
      })
  ).pipe(Option.map(Chunk.unsafeFromArray))

export const backwardSubstituteUpper = (
  upper: Chunk.Chunk<number>,
  size: number,
  rhs: Chunk.Chunk<number>
): Option.Option<Chunk.Chunk<number>> =>
  Option.liftPredicate(
    Tuple.make(upper, rhs),
    () =>
      Boolean.and(
        Number.Equivalence(Chunk.size(upper), Number.multiply(size, size)),
        Number.Equivalence(Chunk.size(rhs), size)
      )
  ).pipe(
    Option.flatMap(() =>
      backwardSubstitute(
        Chunk.toReadonlyArray(upper),
        size,
        Chunk.toReadonlyArray(rhs),
        matrixValueAt
      )
    )
  )

const transposedMatrixValueAt = (
  matrix: ReadonlyArray<number>,
  size: number,
  row: number,
  column: number
): number => matrixValueAt(matrix, size, column, row)

export const solveSpd = (
  matrix: Chunk.Chunk<number>,
  size: number,
  rhs: Chunk.Chunk<number>
): Option.Option<Chunk.Chunk<number>> =>
  choleskySpd(matrix, size).pipe(
    Option.flatMap((lower) =>
      forwardSubstituteLower(lower, size, rhs).pipe(
        Option.flatMap((forward) =>
          backwardSubstitute(
            Chunk.toReadonlyArray(lower),
            size,
            Chunk.toReadonlyArray(forward),
            transposedMatrixValueAt
          )
        )
      )
    )
  )
