/**
 * TPE trial splitting — partitions completed trials into above/below groups by objective direction.
 *
 * @since 0.1.0
 * @module
 */
import { Array as Arr } from "effect"

import { match, type Objective } from "../../Objective.js"
import type { Observation } from "../../Sampler.js"
import { splitMultiObjective } from "./split/multiSplit.js"
import { splitSingleObjective } from "./split/singleSplit.js"
import type { TrialSplit } from "./splitTrials.js"

/**
 * Split completed TPE trials into above/below groups based on objective spec direction.
 *
 * @since 0.1.0
 * @category experimental
 */
export const splitByObjective = (
  completedInput: Iterable<Observation>,
  objectiveSpec: Objective,
  epsilon = 0
): TrialSplit => {
  const completed = Arr.fromIterable(completedInput)
  return match({
    Single: ({ direction }) => splitSingleObjective(completed, direction),
    Multi: ({ directions }) => splitMultiObjective(completed, directions, undefined, epsilon)
  })(objectiveSpec)
}
