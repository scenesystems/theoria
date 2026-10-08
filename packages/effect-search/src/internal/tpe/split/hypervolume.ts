/**
 * Exact loss-space hypervolume and Pareto checks following Optuna's `_hypervolume.wfg` and
 * `study._multi_objective` helpers: a 2-D sweep, an O(n²) 3-D sweep, and WFG for higher dimensions.
 *
 * @since 0.9.0
 */
import { isFinite } from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Boolean as Bool, Data, Equal, HashSet, Match, Number as Num, Option, Order, Tuple } from "effect"

import type { Vector } from "../../../Objective.js"

/** Optuna's `EPS`, used for zero reference coordinates and minimum MOTPE weights. */
export const epsilon = 1e-12

/** Coordinate `index` of a vector the caller has already validated. */
export const coordinate = (vector: Vector, index: number): number => Arr.getUnsafe(vector, index)

/** Row `index` of a matrix the caller has already validated. */
export const rowAt = <A>(rows: ReadonlyArray<A>, index: number): A => Arr.getUnsafe(rows, index)

/** `n` values `f(0) … f(n - 1)`; unlike `Array.makeBy`, a non-positive `n` yields no values. */
export const generate = <A>(n: number, f: (index: number) => A): Array<A> =>
  Bool.match(Num.isGreaterThan(n, 0), {
    onFalse: () => Arr.empty<A>(),
    onTrue: () => Arr.makeBy(n, f)
  })

/** A copy of `values` with position `index` replaced. */
export const replaceAt = <A>(values: ReadonlyArray<A>, index: number, value: A): Array<A> =>
  Arr.map(values, (current, position) =>
    Bool.match(Equal.equals(position, index), {
      onFalse: () => current,
      onTrue: () => value
    }))

const dimensionsOf = (rows: ReadonlyArray<Vector>): number =>
  Option.match(Arr.head(rows), { onNone: () => 0, onSome: Arr.length })

/** Product of `reference - point`, multiplied left to right as `np.prod` does. */
export const inclusiveVolume = (point: Vector, reference: Vector): number =>
  Arr.reduce(
    point,
    1,
    (product, value, index) => Num.multiply(product, Num.subtract(coordinate(reference, index), value))
  )

/** Coordinate-wise maximum, the loss-space intersection of two dominated boxes. */
export const intersection = (left: Vector, right: Vector): Vector =>
  Arr.map(left, (value, index) => Num.max(value, coordinate(right, index)))

const lexicographic = Arr.makeOrder(Num.Order)

const sameVector = (left: Vector, right: Vector): boolean =>
  Arr.every(left, (value, index) => Equal.equals(value, coordinate(right, index)))

/**
 * Lexicographically sorted unique rows, the first source index of each unique row,
 * and each source row's unique position, as `np.unique(axis=0, return_index, return_inverse)`.
 */
export class UniqueRows extends Data.Class<{
  readonly values: ReadonlyArray<Vector>
  readonly first: ReadonlyArray<number>
  readonly inverse: ReadonlyArray<number>
}> {}

class UniqueGroup extends Data.Class<{
  readonly value: Vector
  readonly members: Arr.NonEmptyReadonlyArray<number>
}> {}

export const uniqueRows = (rows: ReadonlyArray<Vector>): UniqueRows => {
  const order = Arr.sort(
    generate(Arr.length(rows), (index) => index),
    Order.mapInput(lexicographic, (index: number) => rowAt(rows, index))
  )
  const groups = Arr.reduce(order, Arr.empty<UniqueGroup>(), (acc, index) => {
    const value = rowAt(rows, index)
    return Option.match(Arr.last(acc), {
      onNone: () => Arr.of(new UniqueGroup({ value, members: Arr.of(index) })),
      onSome: (last) =>
        Bool.match(sameVector(last.value, value), {
          onFalse: () => Arr.append(acc, new UniqueGroup({ value, members: Arr.of(index) })),
          onTrue: () =>
            Arr.append(Arr.dropRight(acc, 1), new UniqueGroup({ value, members: Arr.append(last.members, index) }))
        })
    })
  })
  const positions = Arr.flatMap(
    groups,
    (group, position) => Arr.map(group.members, (member) => Tuple.make(member, position))
  )
  const sortedPositions = Arr.sort(positions, Order.mapInput(Num.Order, (entry: [number, number]) => entry[0]))
  return new UniqueRows({
    values: Arr.map(groups, (group) => group.value),
    // A stable sort keeps equal rows in source order, so the first member is the first occurrence.
    first: Arr.map(groups, (group) => Arr.headNonEmpty(group.members)),
    inverse: Arr.map(sortedPositions, (entry) => entry[1])
  })
}

const isStrictlyBetterSomewhere = (candidate: Vector, top: Vector): boolean =>
  Arr.some(
    candidate,
    (value, index) => Bool.and(Num.isGreaterThan(index, 0), Num.isLessThan(value, coordinate(top, index)))
  )

const paretoFrontNd = (sorted: ReadonlyArray<Vector>): Array<boolean> => {
  const heads = Arr.unfold<ReadonlyArray<number>, number>(
    generate(Arr.length(sorted), (index) => index),
    (remaining) =>
      Option.map(Arr.head(remaining), (top) =>
        Tuple.make(
          top,
          Arr.filter(remaining, (index) => isStrictlyBetterSomewhere(rowAt(sorted, index), rowAt(sorted, top)))
        ))
  )
  const front = HashSet.fromIterable(heads)
  return generate(Arr.length(sorted), (index) => HashSet.has(front, index))
}

const paretoFront2d = (sorted: ReadonlyArray<Vector>): Array<boolean> => {
  const cumulativeMinimum = Arr.tailNonEmpty(
    Arr.scan(sorted, Number.POSITIVE_INFINITY, (minimum, row) => Num.min(minimum, coordinate(row, 1)))
  )
  return generate(Arr.length(sorted), (index) =>
    Bool.match(Equal.equals(index, 0), {
      onFalse: () => Num.isLessThan(rowAt(cumulativeMinimum, index), rowAt(cumulativeMinimum, Num.decrement(index))),
      onTrue: () => true
    }))
}

/**
 * Pareto flags for unique lexsorted rows (`_is_pareto_front_for_unique_sorted`). Later duplicates of
 * a quasi-lexsorted matrix are weakly dominated by their first occurrence.
 */
export const paretoFrontSorted = (sorted: ReadonlyArray<Vector>): Array<boolean> =>
  Match.value(dimensionsOf(sorted)).pipe(
    Match.when(1, () => generate(Arr.length(sorted), (index) => Equal.equals(index, 0))),
    Match.when(2, () => paretoFront2d(sorted)),
    Match.orElse(() => paretoFrontNd(sorted))
  )

/** Pareto flags for arbitrary rows; duplicates of a front point are all on the front. */
export const paretoFront = (rows: ReadonlyArray<Vector>): Array<boolean> => {
  const unique = uniqueRows(rows)
  const flags = paretoFrontSorted(unique.values)
  return Arr.map(unique.inverse, (position) => rowAt(flags, position))
}

const dot = (left: ReadonlyArray<number>, right: ReadonlyArray<number>): number =>
  Num.sumAll(Arr.zipWith(left, right, Num.multiply))

const compute2d = (sorted: ReadonlyArray<Vector>, reference: Vector): number => {
  const diagonalY = Arr.prepend(
    Arr.map(Arr.dropRight(sorted, 1), (row) => coordinate(row, 1)),
    coordinate(reference, 1)
  )
  return dot(
    Arr.map(sorted, (row) => Num.subtract(coordinate(reference, 0), coordinate(row, 0))),
    Arr.map(sorted, (row, index) => Num.subtract(rowAt(diagonalY, index), coordinate(row, 1)))
  )
}

const cumulativeMaximum = (values: ReadonlyArray<number>): Array<number> =>
  Arr.tailNonEmpty(Arr.scan(values, Number.NEGATIVE_INFINITY, Num.max))

const compute3d = (sorted: ReadonlyArray<Vector>, reference: Vector): number => {
  const n = Arr.length(sorted)
  const yOrder = Arr.sort(
    generate(n, (index) => index),
    Order.mapInput(Num.Order, (index: number) => coordinate(rowAt(sorted, index), 1))
  )
  const unassigned: ReadonlyArray<number> = generate(n, () => 0)
  const columnOf = Arr.reduce(yOrder, unassigned, (columns, row, column) => replaceAt(columns, row, column))
  const seeded = generate(n, (row) =>
    generate(n, (column) =>
      Bool.match(Equal.equals(rowAt(columnOf, row), column), {
        onFalse: () => 0,
        onTrue: () => Num.subtract(coordinate(reference, 2), coordinate(rowAt(sorted, row), 2))
      })))
  const downRows = Arr.tailNonEmpty(
    Arr.scan(
      seeded,
      generate(n, () => Number.NEGATIVE_INFINITY),
      (previous, row) => Arr.zipWith(previous, row, Num.max)
    )
  )
  const zDelta = Arr.map(downRows, cumulativeMaximum)
  const xValues = Arr.map(sorted, (row) => coordinate(row, 0))
  const yValues = Arr.map(yOrder, (row) => coordinate(rowAt(sorted, row), 1))
  const deltas = (values: ReadonlyArray<number>, bound: number) =>
    Arr.zipWith(Arr.append(Arr.drop(values, 1), bound), values, Num.subtract)
  const xDelta = deltas(xValues, coordinate(reference, 0))
  const yDelta = deltas(yValues, coordinate(reference, 1))
  return dot(Arr.map(zDelta, (row) => dot(row, yDelta)), xDelta)
}

const exclusiveVolume = (limited: ReadonlyArray<Vector>, inclusive: number, reference: Vector): number =>
  Num.subtract(
    inclusive,
    Bool.match(Num.isLessThanOrEqualTo(Arr.length(limited), 3), {
      onFalse: () => {
        const flags = paretoFrontSorted(limited)
        return computeNd(Arr.filter(limited, (_row, index) => rowAt(flags, index)), reference)
      },
      onTrue: () => computeNd(limited, reference)
    })
  )

const computeNd = (sorted: ReadonlyArray<Vector>, reference: Vector): number =>
  Match.value(Arr.length(sorted)).pipe(
    Match.when(1, () => inclusiveVolume(rowAt(sorted, 0), reference)),
    Match.when(2, () => {
      const first = rowAt(sorted, 0)
      const second = rowAt(sorted, 1)
      return Num.subtract(
        Num.sum(inclusiveVolume(first, reference), inclusiveVolume(second, reference)),
        inclusiveVolume(intersection(first, second), reference)
      )
    }),
    Match.orElse((n) => {
      const inclusive = Arr.map(sorted, (row) => inclusiveVolume(row, reference))
      const exclusive = generate(Num.decrement(n), (index) => {
        const top = rowAt(sorted, index)
        const limited = Arr.map(Arr.drop(sorted, Num.increment(index)), (row) => intersection(top, row))
        return exclusiveVolume(limited, rowAt(inclusive, index), reference)
      })
      return Num.sum(rowAt(inclusive, Num.decrement(n)), Num.sumAll(exclusive))
    })
  )

/**
 * Exact hypervolume of loss vectors dominated within `reference` (`compute_hypervolume`). Rows must
 * not exceed the reference. A non-finite reference or a non-finite result is infinite.
 */
export const hypervolume = (rows: ReadonlyArray<Vector>, reference: Vector, assumePareto = false): number =>
  Bool.match(Arr.every(reference, isFinite), {
    onFalse: () => Number.POSITIVE_INFINITY,
    onTrue: () =>
      Bool.match(Arr.isReadonlyArrayEmpty(rows), {
        onFalse: () => {
          const sorted = Bool.match(assumePareto, {
            onFalse: () => {
              const unique = uniqueRows(rows).values
              const flags = paretoFrontSorted(unique)
              return Arr.filter(unique, (_row, index) => rowAt(flags, index))
            },
            onTrue: () => Arr.sort(rows, Order.mapInput(Num.Order, (row: Vector) => coordinate(row, 0)))
          })
          const volume = Match.value(Arr.length(reference)).pipe(
            Match.when(2, () => compute2d(sorted, reference)),
            Match.when(3, () => compute3d(sorted, reference)),
            Match.orElse(() => computeNd(sorted, reference))
          )
          return Bool.match(isFinite(volume), {
            onFalse: () => Number.POSITIVE_INFINITY,
            onTrue: () => volume
          })
        },
        onTrue: () => 0
      })
  })

/** Optuna's `_get_reference_point`: `max(1.1 * worst, 0.9 * worst)` per objective, zero becoming `EPS`. */
export const lossReferencePoint = (rows: ReadonlyArray<Vector>): Vector =>
  generate(dimensionsOf(rows), (dimension) => {
    const worst = Arr.reduce(rows, Number.NEGATIVE_INFINITY, (acc, row) => Num.max(acc, coordinate(row, dimension)))
    const reference = Num.max(Num.multiply(1.1, worst), Num.multiply(0.9, worst))
    return Bool.match(Equal.equals(reference, 0), {
      onFalse: () => reference,
      onTrue: () => epsilon
    })
  })
