/**
 * Scoped event streams for fresh and resumed study execution.
 *
 * @since 0.1.0
 */
import * as Emitter from "@scenesystems/effect-study/Emitter"
import { Data, Effect, Option, Stream } from "effect"

import type { SearchError } from "../../SearchError.js"
import type * as SearchSpace from "../../SearchSpace.js"
import type * as StudyEvent from "../../StudyEvent.js"
import type * as StudyStorage from "../../StudyStorage.js"
import { EventPublisher } from "./events.js"
import type {
  OptimizeOptionsFromSpace,
  ResumeFromStorageOptionsFromSpace,
  ResumeOptionsFromSpace
} from "./options/input.js"
import type { OptimizePlan } from "./options/plan.js"
import { optimizePlanFromOptions } from "./options/plan/fresh.js"
import { resumeExecutionSeedFromOptions, resumeExecutionSeedFromStorageOptions } from "./recovery.js"
import { defaultExecuteSeed, type ExecuteSeed, executeStudy } from "./runtime.js"

class StreamExecutionPlan<Space extends SearchSpace.SearchSpace = SearchSpace.SearchSpace> extends Data.Class<{
  readonly optimizePlan: OptimizePlan<SearchSpace.Type<Space>, Space>
  readonly seed: Option.Option<ExecuteSeed<SearchSpace.Type<Space>>>
}> {}

const streamFromExecutionPlan = <Space extends SearchSpace.SearchSpace, R>(
  planEffect: Effect.Effect<StreamExecutionPlan<Space>, SearchError, R>
) =>
  planEffect.pipe(
    Effect.map(({ optimizePlan, seed }) =>
      Emitter.toStream((emit: Emitter.Emitter<StudyEvent.Event>) =>
        executeStudy(
          optimizePlan,
          Option.getOrElse(seed, () => defaultExecuteSeed()),
          new EventPublisher({ publish: emit })
        )
      )
    )
  )

/**
 * Runs a study while emitting trial, stopping, scheduler, and completion events
 * as they occur. A successful run ends with `StudyCompleted`. A study-level
 * `SearchError` fails the stream after all events already published; individual
 * objective failures appear as `TrialFailed` events.
 *
 * @remarks
 * Interrupting or ending stream consumption interrupts the scoped execution
 * fiber. Use {@link optimize} when only the final result is needed.
 *
 * @typeParam Space - Compiled search space supplying configurations to the streamed execution.
 *
 * @since 0.1.0
 * @category combinators
 */
export const optimizeStream = <Space extends SearchSpace.SearchSpace>(
  options: OptimizeOptionsFromSpace<Space>
): Stream.Stream<StudyEvent.Event, SearchError> =>
  Stream.unwrap(
    streamFromExecutionPlan(
      optimizePlanFromOptions(options).pipe(
        Effect.map(
          (optimizePlan): StreamExecutionPlan<Space> => new StreamExecutionPlan({ optimizePlan, seed: Option.none() })
        )
      )
    )
  ).pipe(Stream.withSpan("effect-search/Study.optimizeStream"))

/**
 * Restores a validated snapshot and streams events from the additional work.
 * Snapshot history is not replayed. Failure and interruption behavior matches
 * {@link optimizeStream}.
 *
 * @typeParam Space - Compiled search space checked against the snapshot and used for new trials.
 *
 * @since 0.1.0
 * @category combinators
 */
export const resumeStream = <Space extends SearchSpace.SearchSpace>(
  options: ResumeOptionsFromSpace<Space>
): Stream.Stream<StudyEvent.Event, SearchError> =>
  Stream.unwrap(
    streamFromExecutionPlan(
      resumeExecutionSeedFromOptions(options).pipe(
        Effect.map(
          ({ optimizePlan, seed }): StreamExecutionPlan<Space> =>
            new StreamExecutionPlan({ optimizePlan, seed: Option.some(seed) })
        )
      )
    )
  ).pipe(Stream.withSpan("effect-search/Study.resumeStream"))

/**
 * Loads recovery state from {@link StudyStorage} and streams events from the
 * additional work. Persisted event history is not replayed. Loading, validation,
 * and execution failures use the stream's `SearchError` channel.
 *
 * @typeParam Space - Compiled search space checked against persisted state and used for new trials.
 *
 * @since 0.1.0
 * @category combinators
 */
export const resumeFromStorageStream = <Space extends SearchSpace.SearchSpace>(
  options: ResumeFromStorageOptionsFromSpace<Space>
): Stream.Stream<StudyEvent.Event, SearchError, StudyStorage.StudyStorage> =>
  Stream.unwrap(
    streamFromExecutionPlan(
      resumeExecutionSeedFromStorageOptions(options).pipe(
        Effect.map(
          ({ optimizePlan, seed }): StreamExecutionPlan<Space> =>
            new StreamExecutionPlan({ optimizePlan, seed: Option.some(seed) })
        )
      )
    )
  ).pipe(Stream.withSpan("effect-search/Study.resumeFromStorageStream"))
