/**
 * Replaceable execution services and their default Layers.
 *
 * @since 0.1.0
 */
import { Data, Effect, Layer, Option } from "effect"

import type { ObjectiveSpec } from "../contracts/ObjectiveSpec.js"
import type { InvalidStudyConfig, SearchError } from "../Errors/index.js"
import {
  checkpoint,
  restoreCheckpoint,
  type Sampler,
  type SamplerCheckpoint,
  suggest,
  type SuggestContext
} from "../Sampler/index.js"
import type * as SearchSpace from "../SearchSpace/index.js"
import type * as Trial from "../Trial/index.js"
import type { EventPublisher } from "./events.js"
import { noopEventPublisher } from "./events.js"
import { ObjectiveEvaluator, ObjectiveEvaluatorLive } from "./objectiveEvaluator.js"
import type { OptimizePlan } from "./options.js"
import type { ExecuteOutcome, ExecuteSeed } from "./runtime.js"
import { defaultExecuteSeed, executeStudy } from "./runtime.js"
import type { StopMode } from "./runtime/pruning.js"
import type { SnapshotMetadata } from "./snapshot/metadata.js"
import { restoreSnapshot } from "./snapshot/restore.js"
import { snapshotFromTrials, type StudySnapshot } from "./snapshot/versioning.js"

/**
 * Owns sampler suggestion and checkpoint dispatch for study execution. Method
 * failures retain the sampler's typed `SearchError` or `InvalidStudyConfig`
 * channels.
 *
 * @since 0.1.0
 * @category services
 */
export class SamplerEngine extends Effect.Tag("effect-search/Study/SamplerEngine")<
  SamplerEngine,
  {
    /** Requests one encoded candidate from the selected sampler and search space. */
    readonly suggest: (
      sampler: Sampler,
      space: SearchSpace.SearchSpace,
      context: SuggestContext
    ) => Effect.Effect<unknown, SearchError>
    /** Captures resumable state from the selected sampler. */
    readonly checkpoint: (sampler: Sampler) => Effect.Effect<SamplerCheckpoint, SearchError>
    /** Replaces the selected sampler's state from a compatible checkpoint. */
    readonly restoreCheckpoint: (
      sampler: Sampler,
      samplerCheckpoint: SamplerCheckpoint
    ) => Effect.Effect<void, InvalidStudyConfig>
  }
>() {}

/**
 * Delegates sampler operations to their public implementations. Layer
 * acquisition has no requirements and cannot fail.
 *
 * @since 0.1.0
 * @category layers
 */
export const SamplerEngineLive = Layer.succeed(SamplerEngine, {
  suggest: (sampler, space, context) => suggest(sampler, space, context),
  checkpoint,
  restoreCheckpoint
})

/**
 * Creates canonical snapshots and validates recovery compatibility against the
 * requested space, sampler, objective, and stop mode.
 *
 * @since 0.1.0
 * @category services
 */
export class SnapshotCodec extends Effect.Tag("effect-search/Study/SnapshotCodec")<
  SnapshotCodec,
  {
    /** Serializes current trials with the supplied restoration metadata. */
    readonly snapshot: <Config>(
      trials: ReadonlyArray<Trial.Trial<Config>>,
      metadata: SnapshotMetadata
    ) => StudySnapshot
    /** Validates compatibility and reconstructs the next execution seed. */
    readonly restore: <Space extends SearchSpace.SearchSpace>(
      space: Space,
      sampler: Sampler,
      objectiveSpec: ObjectiveSpec,
      stopMode: StopMode,
      snapshot: StudySnapshot
    ) => Effect.Effect<ExecuteSeed<SearchSpace.Type<Space>>, InvalidStudyConfig>
  }
>() {}

/**
 * Uses the canonical versioning and restore implementations. Layer acquisition
 * has no requirements and cannot fail.
 *
 * @since 0.1.0
 * @category layers
 */
export const SnapshotCodecLive = Layer.succeed(SnapshotCodec, {
  snapshot: snapshotFromTrials,
  restore: restoreSnapshot
})

/**
 * Passes a normalized plan, optional recovery seed, and optional event or
 * interruption hooks to {@link StudyKernel}. Missing options use an empty seed,
 * a no-op publisher, and a no-op interruption snapshot sink.
 *
 * @typeParam Space - Compiled search space retained by the execution plan.
 * @typeParam Config - Decoded configuration passed to the objective and stored in trials.
 *
 * @since 0.1.0
 * @category models
 */
export class ExecuteRequest<
  Space extends SearchSpace.SearchSpace = SearchSpace.SearchSpace,
  Config = SearchSpace.Type<Space>
> extends Data.Class<{
  /** Validated plan whose settings are normalized again by execution. */
  readonly options: OptimizePlan<Config, Space>
  /** Restored state; `None` starts trial numbering at zero. */
  readonly seed: Option.Option<ExecuteSeed<Config>>
  /** Event destination; `None` suppresses lifecycle events outside persistence. */
  readonly eventPublisher: Option.Option<EventPublisher>
  /** Called with recovery state when execution fails or is interrupted. */
  readonly interruptionSnapshotSink?: (snapshot: StudySnapshot) => Effect.Effect<void>
}> {}

/**
 * Runs normalized plans into execution outcomes. The method requires
 * {@link ObjectiveEvaluator}; study and sampler failures remain in
 * `SearchError`.
 *
 * @since 0.1.0
 * @category services
 */
export class StudyKernel extends Effect.Tag("effect-search/Study/StudyKernel")<
  StudyKernel,
  {
    /** Runs one plan from its optional recovery state and returns the terminal runtime state. */
    readonly execute: <Space extends SearchSpace.SearchSpace>(
      request: ExecuteRequest<Space>
    ) => Effect.Effect<ExecuteOutcome<SearchSpace.Type<Space>>, SearchError, ObjectiveEvaluator>
  }
>() {}

/**
 * Executes the built-in study runtime with defaults for omitted seed and hooks.
 * Layer acquisition has no requirements and cannot fail.
 *
 * @since 0.1.0
 * @category layers
 */
export const StudyKernelLive = Layer.succeed(StudyKernel, {
  execute: ({ options, seed, eventPublisher, interruptionSnapshotSink }) =>
    executeStudy(
      options,
      Option.getOrElse(seed, () => defaultExecuteSeed()),
      Option.getOrElse(eventPublisher, () => noopEventPublisher),
      interruptionSnapshotSink
    )
})

/**
 * Combines the default objective evaluator, sampler engine, snapshot codec, and
 * study kernel. Objective caching and persistent study storage are optional
 * caller-provided services and are not included.
 *
 * @since 0.1.0
 * @category layers
 */
export const StudyServicesLive = Layer.mergeAll(
  ObjectiveEvaluatorLive,
  SamplerEngineLive,
  SnapshotCodecLive,
  StudyKernelLive
)

export {
  /** @since 0.1.0 */
  ObjectiveEvaluator,
  /** @since 0.1.0 */
  ObjectiveEvaluatorLive
}
