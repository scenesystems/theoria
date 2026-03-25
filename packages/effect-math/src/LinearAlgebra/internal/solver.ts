/**
 * Dense linear-system kernels for symmetric positive-definite matrices.
 *
 * @since 0.1.0
 * @category internal
 */
import { Array as Arr, Chunk, Number as N, Option } from "effect"

import { transpose } from "./matrix.js"

const MATRIX_SOLVER_EPSILON = 1e-12

const abs = (value: number): number => N.max(value, N.negate(value))

const matrixIndex = (size: number, row: number, column: number): number => N.sum(N.multiply(row, size), column)

const matrixValueAt = (
  matrix: Chunk.Chunk<number>,
  size: number,
  row: number,
  column: number
): number => Option.getOrElse(Chunk.get(matrix, matrixIndex(size, row, column)), () => 0)

const lowerKey = (row: number, column: number): string => `${row}:${column}`

const lowerValueAt = (lower: Readonly<Record<string, number>>, row: number, column: number): number =>
  lower[lowerKey(row, column)] ?? 0

const setLowerValue = (
  lower: Readonly<Record<string, number>>,
  row: number,
  column: number,
  value: number
): Readonly<Record<string, number>> => ({
  ...lower,
  [lowerKey(row, column)]: value
})

const lowerToChunk = (lower: Readonly<Record<string, number>>, size: number): Chunk.Chunk<number> =>
  Chunk.makeBy(size * size, (flatIndex) => {
    const row = Math.floor(flatIndex / size)
    const column = flatIndex % size
    return column <= row ? lowerValueAt(lower, row, column) : 0
  })

export const choleskySpd = (
  matrix: Chunk.Chunk<number>,
  size: number
): Option.Option<Chunk.Chunk<number>> => {
  if (Chunk.size(matrix) !== size * size) {
    return Option.none()
  }

  const fillRow = (
    row: number,
    lower: Readonly<Record<string, number>>
  ): Option.Option<Readonly<Record<string, number>>> =>
    Arr.reduce(
      Arr.makeBy(row + 1, (index) => index),
      Option.some(lower),
      (lowerOption, column) =>
        Option.flatMap(lowerOption, (resolvedLower) => {
          const projection = Arr.reduce(
            Arr.makeBy(column, (index) => index),
            0,
            (sum, shared) =>
              N.sum(
                sum,
                N.multiply(
                  lowerValueAt(resolvedLower, row, shared),
                  lowerValueAt(resolvedLower, column, shared)
                )
              )
          )

          if (row === column) {
            const diagonal = N.subtract(matrixValueAt(matrix, size, row, row), projection)

            return diagonal > MATRIX_SOLVER_EPSILON
              ? Option.some(setLowerValue(resolvedLower, row, column, Math.sqrt(diagonal)))
              : Option.none()
          }

          const pivot = lowerValueAt(resolvedLower, column, column)

          return abs(pivot) <= MATRIX_SOLVER_EPSILON
            ? Option.none()
            : Option.some(
              setLowerValue(
                resolvedLower,
                row,
                column,
                N.unsafeDivide(N.subtract(matrixValueAt(matrix, size, row, column), projection), pivot)
              )
            )
        })
    )

  const loop = (
    row: number,
    lower: Readonly<Record<string, number>>
  ): Option.Option<Readonly<Record<string, number>>> =>
    row >= size
      ? Option.some(lower)
      : fillRow(row, lower).pipe(Option.flatMap((next) => loop(row + 1, next)))

  return loop(0, {}).pipe(Option.map((lower) => lowerToChunk(lower, size)))
}

export const forwardSubstituteLower = (
  lower: Chunk.Chunk<number>,
  size: number,
  rhs: Chunk.Chunk<number>
): Option.Option<Chunk.Chunk<number>> => {
  if (Chunk.size(lower) !== size * size || Chunk.size(rhs) !== size) {
    return Option.none()
  }

  const loop = (
    index: number,
    solved: ReadonlyArray<number>
  ): Option.Option<ReadonlyArray<number>> => {
    if (index >= size) {
      return Option.some(solved)
    }

    const projection = Arr.reduce(
      Arr.makeBy(index, (position) => position),
      0,
      (sum, column) =>
        N.sum(
          sum,
          N.multiply(
            matrixValueAt(lower, size, index, column),
            Arr.get(solved, column).pipe(Option.getOrElse(() => 0))
          )
        )
    )
    const diagonal = matrixValueAt(lower, size, index, index)

    if (abs(diagonal) <= MATRIX_SOLVER_EPSILON) {
      return Option.none()
    }

    const nextValue = N.unsafeDivide(
      N.subtract(Option.getOrElse(Chunk.get(rhs, index), () => 0), projection),
      diagonal
    )

    return loop(index + 1, Arr.append(solved, nextValue))
  }

  return loop(0, Arr.empty<number>()).pipe(
    Option.map((solution) => Chunk.fromIterable(solution))
  )
}

export const backwardSubstituteUpper = (
  upper: Chunk.Chunk<number>,
  size: number,
  rhs: Chunk.Chunk<number>
): Option.Option<Chunk.Chunk<number>> => {
  if (Chunk.size(upper) !== size * size || Chunk.size(rhs) !== size) {
    return Option.none()
  }

  const loop = (
    index: number,
    solved: Readonly<Record<string, number>>
  ): Option.Option<Readonly<Record<string, number>>> => {
    if (index < 0) {
      return Option.some(solved)
    }

    const projection = Arr.reduce(
      Arr.makeBy(size - index - 1, (offset) => index + offset + 1),
      0,
      (sum, column) =>
        N.sum(
          sum,
          N.multiply(
            matrixValueAt(upper, size, index, column),
            solved[String(column)] ?? 0
          )
        )
    )
    const diagonal = matrixValueAt(upper, size, index, index)

    if (abs(diagonal) <= MATRIX_SOLVER_EPSILON) {
      return Option.none()
    }

    const nextValue = N.unsafeDivide(
      N.subtract(Option.getOrElse(Chunk.get(rhs, index), () => 0), projection),
      diagonal
    )

    return loop(index - 1, {
      ...solved,
      [String(index)]: nextValue
    })
  }

  return loop(size - 1, {}).pipe(Option.map((solution) => Chunk.makeBy(size, (index) => solution[String(index)] ?? 0)))
}

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
