/**
 * MOTPE below-kernel weights following Optuna's `_calculate_weights_below_for_multi_objective`.
 *
 * @since 0.9.0
 */
import { isFinite } from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Boolean as Bool, Equal, Number as Num } from "effect"

import type { Vector } from "../../../Objective.js"
import {
  epsilon,
  generate,
  hypervolume,
  inclusiveVolume,
  intersection,
  lossReferencePoint,
  paretoFront,
  replaceAt,
  rowAt
} from "./hypervolume.js"

const leaveOneOut = <A>(rows: ReadonlyArray<A>, omitted: number): Array<A> =>
  Arr.filter(rows, (_row, index) => Bool.not(Equal.equals(index, omitted)))

const frontContributions = (front: ReadonlyArray<Vector>, reference: Vector, volume: number): Array<number> =>
  Bool.match(Num.isLessThanOrEqualTo(Arr.length(reference), 3), {
    onFalse: () =>
      Arr.map(front, (point, index) =>
        Num.subtract(
          inclusiveVolume(point, reference),
          hypervolume(Arr.map(leaveOneOut(front, index), (other) => intersection(other, point)), reference)
        )),
    onTrue: () =>
      Arr.map(front, (_point, index) => Num.subtract(volume, hypervolume(leaveOneOut(front, index), reference, true)))
  })

/**
 * Weights for below trials, given their loss vectors and feasibility. Infeasible trials get `EPS`.
 * With at least two feasible trials, feasible weights are hypervolume contributions normalized by the
 * largest contribution and floored at `EPS`; dominated and duplicated trials contribute nothing.
 */
export const motpeBelowWeights = (
  losses: ReadonlyArray<Vector>,
  feasible: ReadonlyArray<boolean>
): Array<number> => {
  const base = Arr.map(feasible, (isFeasible) => Bool.match(isFeasible, { onFalse: () => epsilon, onTrue: () => 1 }))
  const feasibleIndices = Arr.filter(generate(Arr.length(losses), (index) => index), (index) => rowAt(feasible, index))
  return Bool.match(Num.isLessThanOrEqualTo(Arr.length(feasibleIndices), 1), {
    onFalse: () => {
      const feasibleLosses = Arr.map(feasibleIndices, (index) => rowAt(losses, index))
      const reference = lossReferencePoint(feasibleLosses)
      const onFront = paretoFront(feasibleLosses)
      const front = Arr.filter(feasibleLosses, (_loss, index) => rowAt(onFront, index))
      const volume = hypervolume(front, reference, true)
      return Bool.match(isFinite(volume), {
        onFalse: () => base,
        onTrue: () => {
          const contributions = frontContributions(front, reference, volume)
          const frontPositions = Arr.filter(
            generate(Arr.length(feasibleLosses), (index) => index),
            (index) => rowAt(onFront, index)
          )
          const zeros: ReadonlyArray<number> = generate(Arr.length(feasibleLosses), () => 0)
          const byFeasible = Arr.reduce(
            frontPositions,
            zeros,
            (acc, position, frontIndex) => replaceAt(acc, position, rowAt(contributions, frontIndex))
          )
          const normalizer = Num.max(Arr.reduce(byFeasible, Number.NEGATIVE_INFINITY, Num.max), epsilon)
          return Arr.reduce(
            feasibleIndices,
            base,
            (weights, index, feasiblePosition) =>
              replaceAt(
                weights,
                index,
                Num.max(Num.divideUnsafe(rowAt(byFeasible, feasiblePosition), normalizer), epsilon)
              )
          )
        }
      })
    },
    onTrue: () => base
  })
}
