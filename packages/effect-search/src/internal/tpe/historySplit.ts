/**
 * TPE history splitting — evaluates configured constraints and partitions one suggestion context.
 *
 * @since 0.9.0
 */
import { Array as Arr, Effect, Option } from "effect"

import type { Constraint, Context } from "../../Sampler.js"
import { enrichCompletedTrialsWithConstraints, enrichPrunedTrialsWithConstraints } from "./constraints/enrich.js"
import { splitByObjective } from "./split.js"
import type { TrialSplit } from "./splitTrials.js"

/**
 * Splits one suggestion context into the below and above trial groups.
 * Configured constraints are evaluated for completed and pruned trials; pending
 * reservations reach the split only when the sampler enables constant liar.
 *
 * @since 0.9.0
 * @category sampling
 */
export const splitHistory = (
  context: Context,
  constraintsInput: Iterable<Constraint>
): Effect.Effect<TrialSplit> => {
  const constraints = Arr.fromIterable(constraintsInput)
  return Effect.all({
    completed: enrichCompletedTrialsWithConstraints(context.completed, constraints),
    pruned: enrichPrunedTrialsWithConstraints(
      Option.fromNullishOr(context.pruned).pipe(Option.getOrElse(() => [])),
      constraints
    )
  }).pipe(
    Effect.map(({ completed, pruned }) =>
      splitByObjective(completed, context.objectiveSpec, context.epsilon, pruned, context.pending)
    )
  )
}
