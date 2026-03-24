/**
 * TPE trial splitting — partitions completed trials into above/below groups by objective direction.
 *
 * @since 0.1.0
 */
import { matchObjectiveSpec, type ObjectiveSpec } from "../../../contracts/ObjectiveSpec.js"
import type { TrialSplit } from "../../../internal/tpe/splitTrials.js"
import type { SuggestCompletedTrial } from "../../../Sampler/index.js"
import { splitMultiObjective } from "./multiSplit.js"
import { splitSingleObjective } from "./singleSplit.js"

/**
 * Split completed TPE trials into above/below groups based on objective spec direction.
 *
 * @since 0.1.0
 * @category experimental
 */
export const splitByObjectiveSpec = (
  completed: ReadonlyArray<SuggestCompletedTrial>,
  objectiveSpec: ObjectiveSpec,
  epsilon = 0
): TrialSplit =>
  matchObjectiveSpec({
    Single: ({ direction }) => splitSingleObjective(completed, direction),
    Multi: ({ directions }) => splitMultiObjective(completed, directions, undefined, epsilon)
  })(objectiveSpec)
