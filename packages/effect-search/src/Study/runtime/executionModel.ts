/**
 * Execution model types and constructors for study runtime orchestration.
 *
 * @since 0.1.0
 */
import { Data, Effect } from "effect"

import { type ObjectiveSpec } from "../../contracts/ObjectiveSpec.js"
import type * as Scheduler from "../../Scheduler/index.js"
import type * as SearchSpace from "../../SearchSpace/index.js"
import type * as StudyEvent from "../../StudyEvent/index.js"
import type * as Trial from "../../Trial/index.js"
import type { SnapshotMetadata } from "../snapshot/metadata.js"
import type { StudySnapshot } from "../snapshot/versioning.js"

/**
 * Initial state when resuming a study.
 *
 * @since 0.1.0
 * @category type-level
 */
export class ExecuteSeed<Config = unknown> extends Data.Class<{
  readonly initialTrials: ReadonlyArray<Trial.Trial<Config>>
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
 * @since 0.1.0
 * @category type-level
 */
export class ExecuteOutcome<Config = unknown> extends Data.Class<{
  readonly snapshotMetadata: SnapshotMetadata
  readonly objectiveSpec: ObjectiveSpec
  readonly epsilon: number
  readonly trials: Array<Trial.Trial<Config>>
  readonly completed: Array<Trial.CompletedTrial<Config>>
  readonly completionReason: StudyEvent.CompletionReason
  readonly schedulerSummary?: Scheduler.SchedulerSummary
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
export type InterruptionSnapshotSink = (snapshot: StudySnapshot) => Effect.Effect<void>

/**
 * @since 0.1.0
 * @category constructors
 */
export const noopInterruptionSnapshotSink: InterruptionSnapshotSink = () => Effect.void
