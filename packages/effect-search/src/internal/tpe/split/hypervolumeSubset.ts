import { Array as Arr, Boolean as Bool, Equal, Number as Num, Option } from "effect"

import type { Vector } from "../../../Objective.js"
import { argmax } from "../expectedImprovement.js"

const coordinate = (point: Vector, dimension: number): number => Arr.get(point, dimension).pipe(Option.getOrThrow)

/** Exact dominated volume by slicing loss-space boxes along one coordinate. */
const volume = (points: ReadonlyArray<Vector>, reference: Vector, dimension = 0): number =>
  Bool.match(Equal.equals(Arr.length(points), 0), {
    onFalse: () => {
      const bound = coordinate(reference, dimension)
      const levels = Arr.sort(Arr.dedupe(Arr.map(points, (point) => coordinate(point, dimension))), Num.Order)
      return Bool.match(Equal.equals(Num.increment(dimension), Arr.length(reference)), {
        onFalse: () =>
          Num.sumAll(Arr.map(levels, (level, index) => {
            const next = Arr.get(levels, Num.increment(index)).pipe(Option.getOrElse(() => bound))
            const slice = Arr.filter(points, (point) => Num.isLessThanOrEqualTo(coordinate(point, dimension), level))
            return Num.multiply(
              Num.max(0, Num.subtract(next, level)),
              volume(slice, reference, Num.increment(dimension))
            )
          })),
        onTrue: () => Num.max(0, Num.subtract(bound, Arr.head(levels).pipe(Option.getOrThrow)))
      })
    },
    onTrue: () => 0
  })

/** Greedy marginal hypervolume selection, retaining the earliest index on ties. */
export const hypervolumeSubset = (points: ReadonlyArray<Vector>, reference: Vector, size: number): Array<number> =>
  Arr.reduce(Arr.makeBy(size, (index) => index), Arr.empty<number>(), (selected) => {
    const remaining = Arr.filter(
      Arr.makeBy(Arr.length(points), (index) => index),
      (index) => Bool.not(Arr.contains(selected, index))
    )
    const selectedPoints = Arr.map(selected, (index) => Arr.get(points, index).pipe(Option.getOrThrow))
    const scores = Arr.map(
      remaining,
      (index) => volume(Arr.append(selectedPoints, Arr.get(points, index).pipe(Option.getOrThrow)), reference)
    )
    return Arr.append(selected, Arr.get(remaining, argmax(scores)).pipe(Option.getOrThrow))
  })
