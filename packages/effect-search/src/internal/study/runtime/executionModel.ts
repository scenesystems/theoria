/**
 * Seed and outcome records exchanged with the study execution service.
 *
 * @since 0.1.0
 */
import { Data, Effect } from "effect"

import { type Objective } from "../../../Objective.js"
import type * as Scheduler from "../../../Scheduler.js"
import type { ArtifactStorageError } from "../../../SearchError.js"
import type * as SearchSpace from "../../../SearchSpace.js"
import type * as StudyEvent from "../../../StudyEvent.js"
import type * as StudySnapshot from "../../../StudySnapshot.js"
import type * as Trial from "../../../Trial.js"

/**
 * Supplies restored trials and the number assigned to the next scheduled trial.
 * Execution trusts both fields to have passed snapshot recovery validation.
 *
 * @typeParam Config - Decoded search-space configuration retained by restored trials.
 *
 * @since 0.1.0
 * @category type-level
 */
export class ExecuteSeed<Config = unknown> extends Data.Class<{
  /** Restored trial records used to initialize sampler and study state. */
  readonly initialTrials: ReadonlyArray<Trial.Trial<Config>>
  /** First number available to newly scheduled work. */
  readonly startTrialNumber: number
}> {}

/**
 * Returns an empty seed with no prior trials, starting trial numbering at zero.
 *
 * @since 0.1.0
 * @category constructors
 */
export const defaultExecuteSeed = <Config>(): ExecuteSeed<Config> =>
  new ExecuteSeed({
    initialTrials: [],
    startTrialNumber: 0
  })

/**
 * Carries completed runtime state to public result
 * construction. `completed` is a narrowed subset of `trials`; scheduler output
 * is absent for flat studies.
 *
 * @typeParam Config - Decoded search-space configuration retained by runtime trials.
 *
 * @since 0.1.0
 * @category type-level
 */
export class ExecuteOutcome<Config = unknown> extends Data.Class<{
  /** Compatibility metadata captured before execution. */
  readonly snapshotMetadata: StudySnapshot.Metadata
  /** Scalar direction or multi-objective directions used by the run. */
  readonly objectiveSpec: Objective
  /** Dominance tolerance used only during multi-objective result construction. */
  readonly epsilon: number
  /** All runtime trials in trial-number order. */
  readonly trials: Array<Trial.Trial<Config>>
  /** Successful terminal trials from `trials`. */
  readonly completed: Array<Trial.CompletedTrial<Config>>
  /** Condition that stopped admission of new work. */
  readonly completionReason: StudyEvent.CompletionReason
  /** Bracket and round summaries for scheduled execution. */
  readonly schedulerSummary?: Scheduler.Summary
}> {}

/**
 * @since 0.1.0
 * @category type-level
 */
export type ConfigFor<Space extends SearchSpace.SearchSpace> = SearchSpace.Type<Space>

/**
 * @since 0.1.0
 * @category type-level
 */
export type InterruptionSnapshotSink = (snapshot: StudySnapshot.Snapshot) => Effect.Effect<void, ArtifactStorageError>

/**
 * @since 0.1.0
 * @category constructors
 */
export const noopInterruptionSnapshotSink: InterruptionSnapshotSink = () => Effect.void
