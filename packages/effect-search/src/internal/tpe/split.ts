/**
 * TPE trial splitting — partitions completed trials into above/below groups by objective direction.
 *
 * @since 0.1.0
 * @module
 */
import { Array as Arr, Order } from "effect"

import { match, type Objective } from "../../Objective.js"
import type { Observation, Pending } from "../../Sampler.js"
import type { ConstrainedPrunedObservation } from "./constraints/enrich.js"
import { splitMultiObjective } from "./split/multiSplit.js"
import { splitSingleObjective } from "./split/singleSplit.js"
import { CompletedTrialForSplit, type TrialSplit } from "./splitTrials.js"

/**
 * Split completed TPE trials into above/below groups based on objective spec direction.
 *
 * @since 0.1.0
 * @category experimental
 */
export const splitByObjective = (
  completedInput: Iterable<Observation>,
  objectiveSpec: Objective,
  epsilon = 0,
  prunedInput: Iterable<ConstrainedPrunedObservation> = [],
  pendingInput: Iterable<Pending> = []
): TrialSplit => {
  const completed = Arr.fromIterable(completedInput)
  const split = match({
    Single: ({ direction }) => splitSingleObjective(completed, direction, prunedInput),
    Multi: ({ directions }) => splitMultiObjective(completed, directions, undefined, epsilon)
  })(objectiveSpec)
  return {
    below: split.below,
    above: Arr.sort(
      Arr.appendAll(
        split.above,
        Arr.map(Arr.fromIterable(pendingInput), (trial) =>
          new CompletedTrialForSplit({
            trialNumber: trial.trialNumber,
            config: trial.config,
            state: "running",
            value: 0
          }))
      ),
      Order.mapInput(Order.Number, (trial: CompletedTrialForSplit) => trial.trialNumber)
    )
  }
}
