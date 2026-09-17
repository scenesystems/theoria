/**
 * Dense linear-system kernels for symmetric positive-definite matrices.
 *
 * @since 0.1.0
 * @category internal
 */
import { Array, Boolean, Chunk, Number, Option, Tuple } from "effect"

import { abs, ceil, sqrt } from "../../Numeric.js"

const solverEpsilon = 1e-12

const indices = (size: number): Chunk.Chunk<number> =>
  Boolean.match(Number.greaterThan(size, 0), {
    onFalse: Chunk.empty,
    onTrue: () => Chunk.makeBy(ceil(size), (index) => index)
  })

const matrixIndex = (size: number, row: number, column: number): number =>
  Number.sum(Number.multiply(row, size), column)

const matrixValueAt = (
  matrix: ReadonlyArray<number>,
  size: number,
  row: number,
  column: number
): number => Array.unsafeGet(matrix, matrixIndex(size, row, column))

const isSymmetricMatrix = (
  matrix: ReadonlyArray<number>,
  size: number,
  allIndices: Chunk.Chunk<number>
): boolean =>
  Chunk.every(
    allIndices,
    (row) =>
      Chunk.every(Chunk.drop(allIndices, Number.increment(row)), (column) => {
        return Number.lessThanOrEqualTo(
          abs(Number.subtract(matrixValueAt(matrix, size, row, column), matrixValueAt(matrix, size, column, row))),
          solverEpsilon
        )
      })
  )

export const choleskySpd = (
  matrix: Chunk.Chunk<number>,
  size: number
): Option.Option<Chunk.Chunk<number>> => {
  const transientMatrix = Chunk.toReadonlyArray(matrix)
  const allIndices = indices(size)
  return Option.liftPredicate(matrix, () => Number.greaterThan(size, 0)).pipe(
    Option.filter(() => Number.Equivalence(Chunk.size(matrix), Number.multiply(size, size))),
    Option.filter(() => isSymmetricMatrix(transientMatrix, size, allIndices)),
    Option.flatMap(() =>
      Chunk.reduce(
        allIndices,
        Option.some(Chunk.empty<Chunk.Chunk<number>>()),
        (completedRowsOption, row) =>
          Option.flatMap(completedRowsOption, (completedRows) => {
            return Chunk.reduce(
              Chunk.take(allIndices, Number.increment(row)),
              Option.some(Chunk.empty<number>()),
              (partialRowOption, column) =>
                Option.flatMap(partialRowOption, (partialRow) => {
                  const projection = Chunk.reduce(
                    Chunk.take(allIndices, column),
                    0,
                    (sum, shared) => {
                      const columnFactor = Boolean.match(Number.Equivalence(row, column), {
                        onFalse: () => Chunk.unsafeGet(Chunk.unsafeGet(completedRows, column), shared),
                        onTrue: () => Chunk.unsafeGet(partialRow, shared)
                      })
                      return Number.sum(
                        sum,
                        Number.multiply(
                          Chunk.unsafeGet(partialRow, shared),
                          columnFactor
                        )
                      )
                    }
                  )
                  return Boolean.match(Number.Equivalence(row, column), {
                    onTrue: () =>
                      Option.liftPredicate(
                        Number.subtract(matrixValueAt(transientMatrix, size, row, row), projection),
                        Number.greaterThan(solverEpsilon)
                      ).pipe(
                        Option.map((diagonal) => Chunk.append(partialRow, sqrt(diagonal)))
                      ),
                    onFalse: () =>
                      Option.liftPredicate(
                        Chunk.unsafeGet(Chunk.unsafeGet(completedRows, column), column),
                        (pivot) => Number.greaterThan(abs(pivot), solverEpsilon)
                      ).pipe(
                        Option.map((pivot) =>
                          Chunk.append(
                            partialRow,
                            Number.unsafeDivide(
                              Number.subtract(matrixValueAt(transientMatrix, size, row, column), projection),
                              pivot
                            )
                          )
                        )
                      )
                  })
                })
            ).pipe(
              Option.map((partialRow) => Chunk.append(completedRows, partialRow))
            )
          })
      ).pipe(
        Option.map((lowerRows) =>
          Chunk.flatMap(lowerRows, (lowerRow, row) =>
            Chunk.appendAll(
              lowerRow,
              Chunk.map(Chunk.drop(allIndices, Number.increment(row)), () => 0)
            ))
        )
      )
    )
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
      const allIndices = indices(size)
      return Chunk.reduce(
        allIndices,
        Option.some(Chunk.empty<number>()),
        (solvedOption, index) =>
          Option.flatMap(solvedOption, (solved) => {
            const projection = Chunk.reduce(
              Chunk.take(allIndices, index),
              0,
              (sum, column) =>
                Number.sum(
                  sum,
                  Number.multiply(
                    matrixValueAt(transientLower, size, index, column),
                    Chunk.unsafeGet(solved, column)
                  )
                )
            )
            return Option.liftPredicate(
              matrixValueAt(transientLower, size, index, index),
              (diagonal) => Number.greaterThan(abs(diagonal), solverEpsilon)
            ).pipe(
              Option.map((diagonal) =>
                Chunk.append(
                  solved,
                  Number.unsafeDivide(
                    Number.subtract(Array.unsafeGet(transientRhs, index), projection),
                    diagonal
                  )
                )
              )
            )
          })
      )
    })
  )

const backwardSubstitute = (
  upper: ReadonlyArray<number>,
  size: number,
  rhs: ReadonlyArray<number>,
  valueAt: (matrix: ReadonlyArray<number>, size: number, row: number, column: number) => number
): Option.Option<Chunk.Chunk<number>> => {
  const allIndices = indices(size)
  return Chunk.reduce(
    Chunk.reverse(allIndices),
    Option.some(Chunk.empty<number>()),
    (solvedOption, index) =>
      Option.flatMap(solvedOption, (solved) => {
        const projection = Chunk.reduce(
          Chunk.drop(allIndices, Number.increment(index)),
          0,
          (sum, column, columnOffset) =>
            Number.sum(
              sum,
              Number.multiply(
                valueAt(upper, size, index, column),
                Chunk.unsafeGet(solved, columnOffset)
              )
            )
        )
        return Option.liftPredicate(
          valueAt(upper, size, index, index),
          (diagonal) => Number.greaterThan(abs(diagonal), solverEpsilon)
        ).pipe(
          Option.map((diagonal) =>
            Chunk.prepend(
              solved,
              Number.unsafeDivide(
                Number.subtract(Array.unsafeGet(rhs, index), projection),
                diagonal
              )
            )
          )
        )
      })
  )
}

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
