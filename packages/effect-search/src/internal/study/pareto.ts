/**
 * Pareto front extraction for multi-objective optimization results.
 *
 * @since 0.1.0
 */
import { Array as Arr, Number as Num, Order } from "effect"

import type { Direction } from "../../Direction.js"
import { toVector } from "../../Objective.js"
import { nonDominatedIndices } from "../../Pareto.js"
import type * as Trial from "../../Trial.js"

/**
 * Extracts the non-dominated Pareto front from completed trials, applying epsilon-dominance tolerance and sorting by trial number.
 *
 * @since 0.1.0
 * @category utils
 */
export const paretoFrontFromCompleted = <Config>(
  completed: ReadonlyArray<Trial.CompletedTrial<Config>>,
  directions: ReadonlyArray<Direction>,
  epsilon = 0
): Array<Trial.CompletedTrial<Config>> =>
  Arr.sort(
    Arr.filterMap(
      nonDominatedIndices(
        Arr.map(completed, (trial) => toVector(trial.state.value)),
        directions,
        epsilon
      ),
      (index) => Arr.get(completed, index)
    ),
    Order.mapInput(Num.Order, (trial: Trial.CompletedTrial<Config>) => trial.trialNumber)
  )
