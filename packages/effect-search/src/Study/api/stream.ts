/**
 * Scoped event streams for fresh and resumed study execution.
 *
 * @since 0.1.0
 */
import { type EmitterSink, streamFromEmitter } from "@scenesystems/effect-study/Events"
import { Data, Effect, Option, Stream } from "effect"

import type { SearchError } from "../../Errors/index.js"
import type * as SearchSpace from "../../SearchSpace/index.js"
import type * as StudyEvent from "../../StudyEvent/index.js"
import { EventPublisher } from "../events.js"
import {
  type OptimizeOptionsFromSpace,
  type OptimizePlan,
  optimizePlanFromOptions,
  type ResumeFromStorageOptionsFromSpace,
  type ResumeOptionsFromSpace
} from "../options.js"
import { type ExecuteSeed } from "../runtime.js"
import { ExecuteRequest, StudyKernel, StudyServicesLive } from "../services.js"
import type { StudyStorage } from "../studyStorage.js"
import { resumeExecutionSeedFromOptions, resumeExecutionSeedFromStorageOptions } from "./resumeSeed.js"

class StreamExecutionPlan<Space extends SearchSpace.SearchSpace = SearchSpace.SearchSpace> extends Data.Class<{
  readonly optimizePlan: OptimizePlan<SearchSpace.Type<Space>, Space>
  readonly seed: Option.Option<ExecuteSeed<SearchSpace.Type<Space>>>
}> {}

const streamFromExecutionPlan = <Space extends SearchSpace.SearchSpace, R>(
  planEffect: Effect.Effect<StreamExecutionPlan<Space>, SearchError, R>
) =>
  Effect.gen(function*() {
    const { optimizePlan, seed } = yield* planEffect
    const studyKernel = yield* StudyKernel
    return streamFromEmitter((emit: EmitterSink<StudyEvent.StudyEvent>) =>
      studyKernel.execute(
        new ExecuteRequest({
          options: optimizePlan,
          seed,
          eventPublisher: Option.some(new EventPublisher({ publish: emit }))
        })
      )
    )
  })

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
): Stream.Stream<StudyEvent.StudyEvent, SearchError> =>
  Stream.unwrap(
    streamFromExecutionPlan(
      optimizePlanFromOptions(options).pipe(
        Effect.map(
          (optimizePlan): StreamExecutionPlan<Space> => new StreamExecutionPlan({ optimizePlan, seed: Option.none() })
        )
      )
    )
  ).pipe(Stream.provideSomeLayer(StudyServicesLive), Stream.withSpan("effect-search/Study.optimizeStream"))

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
): Stream.Stream<StudyEvent.StudyEvent, SearchError> =>
  Stream.unwrap(
    streamFromExecutionPlan(
      resumeExecutionSeedFromOptions(options).pipe(
        Effect.map(
          ({ optimizePlan, seed }): StreamExecutionPlan<Space> =>
            new StreamExecutionPlan({ optimizePlan, seed: Option.some(seed) })
        )
      )
    )
  ).pipe(Stream.provideSomeLayer(StudyServicesLive), Stream.withSpan("effect-search/Study.resumeStream"))

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
): Stream.Stream<StudyEvent.StudyEvent, SearchError, StudyStorage> =>
  Stream.unwrap(
    streamFromExecutionPlan(
      resumeExecutionSeedFromStorageOptions(options).pipe(
        Effect.map(
          ({ optimizePlan, seed }): StreamExecutionPlan<Space> =>
            new StreamExecutionPlan({ optimizePlan, seed: Option.some(seed) })
        )
      )
    )
  ).pipe(Stream.provideSomeLayer(StudyServicesLive), Stream.withSpan("effect-search/Study.resumeFromStorageStream"))
