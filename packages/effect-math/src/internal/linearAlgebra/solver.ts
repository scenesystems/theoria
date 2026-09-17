/**
 * Dense linear-system kernels for symmetric positive-definite matrices.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Chunk, Iterable, Number, Option, Tuple } from "effect"

import { abs, floor, sqrt } from "../../Numeric.js"
import { transpose } from "./matrix.js"

const solverEpsilon = 1e-12

const indices = (size: number): Chunk.Chunk<number> =>
  Chunk.fromIterable(
    Iterable.unfold(0, (index) =>
      Boolean.match(Number.lessThan(index, size), {
        onFalse: Option.none,
        onTrue: () => Option.some(Tuple.make(index, Number.increment(index)))
      }))
  )

const matrixIndex = (size: number, row: number, column: number): number =>
  Number.sum(Number.multiply(row, size), column)

const matrixValueAt = (
  matrix: Chunk.Chunk<number>,
  size: number,
  row: number,
  column: number
): number => Option.getOrElse(Chunk.get(matrix, matrixIndex(size, row, column)), () => 0)

const setMatrixValue = (
  matrix: Chunk.Chunk<number>,
  size: number,
  row: number,
  column: number,
  value: number
): Chunk.Chunk<number> => Chunk.replace(matrix, matrixIndex(size, row, column), value)

const isSymmetricMatrix = (matrix: Chunk.Chunk<number>, size: number): boolean =>
  Chunk.every(indices(size), (row) =>
    Chunk.every(
      Chunk.filter(indices(size), (column) => Number.greaterThan(column, row)),
      (column) =>
        Number.lessThanOrEqualTo(
          abs(Number.subtract(matrixValueAt(matrix, size, row, column), matrixValueAt(matrix, size, column, row))),
          solverEpsilon
        )
    ))

const lowerCoordinates = (size: number) =>
  Chunk.flatMap(indices(size), (row) => Chunk.map(indices(Number.increment(row)), (column) => Tuple.make(row, column)))

const lowerToChunk = (lower: Chunk.Chunk<number>, size: number): Chunk.Chunk<number> =>
  Chunk.map(indices(Number.multiply(size, size)), (flatIndex) => {
    const row = floor(Number.unsafeDivide(flatIndex, size))
    const column = Number.remainder(flatIndex, size)
    return Boolean.match(Number.lessThanOrEqualTo(column, row), {
      onFalse: () => 0,
      onTrue: () => matrixValueAt(lower, size, row, column)
    })
  })

export const choleskySpd = (
  matrix: Chunk.Chunk<number>,
  size: number
): Option.Option<Chunk.Chunk<number>> =>
  Option.liftPredicate(
    matrix,
    () =>
      Boolean.and(
        Number.greaterThan(size, 0),
        Boolean.and(
          Number.Equivalence(Chunk.size(matrix), Number.multiply(size, size)),
          isSymmetricMatrix(matrix, size)
        )
      )
  ).pipe(
    Option.flatMap(() =>
      Chunk.reduce(
        lowerCoordinates(size),
        Option.some(Chunk.map(indices(Number.multiply(size, size)), () => 0)),
        (lowerOption, coordinate) =>
          Option.flatMap(lowerOption, (lower) => {
            const row = Tuple.getFirst(coordinate)
            const column = Tuple.getSecond(coordinate)
            const projection = Chunk.reduce(
              indices(column),
              0,
              (sum, shared) =>
                Number.sum(
                  sum,
                  Number.multiply(
                    matrixValueAt(lower, size, row, shared),
                    matrixValueAt(lower, size, column, shared)
                  )
                )
            )
            return Boolean.match(Number.Equivalence(row, column), {
              onTrue: () =>
                Option.liftPredicate(
                  Number.subtract(matrixValueAt(matrix, size, row, row), projection),
                  Number.greaterThan(solverEpsilon)
                ).pipe(
                  Option.map((diagonal) => setMatrixValue(lower, size, row, column, sqrt(diagonal)))
                ),
              onFalse: () =>
                Option.liftPredicate(
                  matrixValueAt(lower, size, column, column),
                  (pivot) => Number.greaterThan(abs(pivot), solverEpsilon)
                ).pipe(
                  Option.map((pivot) =>
                    setMatrixValue(
                      lower,
                      size,
                      row,
                      column,
                      Number.unsafeDivide(
                        Number.subtract(matrixValueAt(matrix, size, row, column), projection),
                        pivot
                      )
                    )
                  )
                )
            })
          })
      )
    ),
    Option.map((lower) => lowerToChunk(lower, size))
  )

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
    Option.flatMap(() =>
      Chunk.reduce(
        indices(size),
        Option.some(Chunk.empty<number>()),
        (solvedOption, index) =>
          Option.flatMap(solvedOption, (solved) => {
            const projection = Chunk.reduce(
              indices(index),
              0,
              (sum, column) =>
                Number.sum(
                  sum,
                  Number.multiply(
                    matrixValueAt(lower, size, index, column),
                    Option.getOrElse(Chunk.get(solved, column), () => 0)
                  )
                )
            )
            return Option.liftPredicate(
              matrixValueAt(lower, size, index, index),
              (diagonal) => Number.greaterThan(abs(diagonal), solverEpsilon)
            ).pipe(
              Option.map((diagonal) =>
                Chunk.append(
                  solved,
                  Number.unsafeDivide(
                    Number.subtract(Option.getOrElse(Chunk.get(rhs, index), () => 0), projection),
                    diagonal
                  )
                )
              )
            )
          })
      )
    )
  )

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
      Chunk.reduce(
        Chunk.reverse(indices(size)),
        Option.some(Chunk.map(indices(size), () => 0)),
        (solvedOption, index) =>
          Option.flatMap(solvedOption, (solved) => {
            const projection = Chunk.reduce(
              Chunk.filter(indices(size), (column) => Number.greaterThan(column, index)),
              0,
              (sum, column) =>
                Number.sum(
                  sum,
                  Number.multiply(
                    matrixValueAt(upper, size, index, column),
                    Option.getOrElse(Chunk.get(solved, column), () => 0)
                  )
                )
            )
            return Option.liftPredicate(
              matrixValueAt(upper, size, index, index),
              (diagonal) => Number.greaterThan(abs(diagonal), solverEpsilon)
            ).pipe(
              Option.map((diagonal) =>
                Chunk.replace(
                  solved,
                  index,
                  Number.unsafeDivide(
                    Number.subtract(Option.getOrElse(Chunk.get(rhs, index), () => 0), projection),
                    diagonal
                  )
                )
              )
            )
          })
      )
    )
  )

export const solveSpd = (
  matrix: Chunk.Chunk<number>,
  size: number,
  rhs: Chunk.Chunk<number>
): Option.Option<Chunk.Chunk<number>> =>
  choleskySpd(matrix, size).pipe(
    Option.flatMap((lower) =>
      forwardSubstituteLower(lower, size, rhs).pipe(
        Option.flatMap((forward) => backwardSubstituteUpper(transpose(lower, size, size, size, 0), size, forward))
      )
    )
  )
