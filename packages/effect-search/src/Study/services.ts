/**
 * Study service layer wiring sampler, scheduler, and storage dependencies.
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
 * @since 0.1.0
 * @category services
 */
export class SamplerEngine extends Effect.Tag("effect-search/Study/SamplerEngine")<
  SamplerEngine,
  {
    readonly suggest: (
      sampler: Sampler,
      space: SearchSpace.SearchSpace,
      context: SuggestContext
    ) => Effect.Effect<unknown, SearchError>
    readonly checkpoint: (sampler: Sampler) => Effect.Effect<SamplerCheckpoint, SearchError>
    readonly restoreCheckpoint: (
      sampler: Sampler,
      samplerCheckpoint: SamplerCheckpoint
    ) => Effect.Effect<void, InvalidStudyConfig>
  }
>() {}

/**
 * @since 0.1.0
 * @category layers
 */
export const SamplerEngineLive = Layer.succeed(SamplerEngine, {
  suggest: (sampler, space, context) => suggest(sampler, space, context),
  checkpoint,
  restoreCheckpoint
})

/**
 * @since 0.1.0
 * @category services
 */
export class SnapshotCodec extends Effect.Tag("effect-search/Study/SnapshotCodec")<
  SnapshotCodec,
  {
    readonly snapshot: <Config>(
      trials: ReadonlyArray<Trial.Trial<Config>>,
      metadata: SnapshotMetadata
    ) => StudySnapshot
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
 * @since 0.1.0
 * @category layers
 */
export const SnapshotCodecLive = Layer.succeed(SnapshotCodec, {
  snapshot: snapshotFromTrials,
  restore: restoreSnapshot
})

/**
 * @since 0.1.0
 * @category models
 */
export class ExecuteRequest<
  Space extends SearchSpace.SearchSpace = SearchSpace.SearchSpace,
  Config = SearchSpace.Type<Space>
> extends Data.Class<{
  readonly options: OptimizePlan<Config, Space>
  readonly seed: Option.Option<ExecuteSeed<Config>>
  readonly eventPublisher: Option.Option<EventPublisher>
  readonly interruptionSnapshotSink?: (snapshot: StudySnapshot) => Effect.Effect<void>
}> {}

/**
 * @since 0.1.0
 * @category services
 */
export class StudyKernel extends Effect.Tag("effect-search/Study/StudyKernel")<
  StudyKernel,
  {
    readonly execute: <Space extends SearchSpace.SearchSpace>(
      request: ExecuteRequest<Space>
    ) => Effect.Effect<ExecuteOutcome<SearchSpace.Type<Space>>, SearchError, ObjectiveEvaluator>
  }
>() {}

/**
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
 * Composed layer providing all study services.
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
