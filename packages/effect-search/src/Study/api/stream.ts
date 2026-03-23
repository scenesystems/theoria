/**
 * Streaming study execution API that emits StudyEvents during optimization.
 *
 * @since 0.1.0
 */
import { Data, Effect, Option, PubSub, Ref, Stream } from "effect"
import type { Scope } from "effect"

import type { SearchError } from "../../Errors/index.js"
import type * as SearchSpace from "../../SearchSpace/index.js"
import type * as StudyEvent from "../../StudyEvent/index.js"
import { eventPublisherFromPubSub } from "../events.js"
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
    const pubsub = yield* PubSub.unbounded<StudyEvent.StudyEvent>()
    const failureRef = yield* Ref.make<Option.Option<SearchError>>(Option.none())
    yield* Effect.addFinalizer(() => PubSub.shutdown(pubsub))

    yield* studyKernel.execute(
      new ExecuteRequest({
        options: optimizePlan,
        seed,
        eventPublisher: Option.some(eventPublisherFromPubSub(pubsub))
      })
    ).pipe(
      Effect.matchEffect({
        onFailure: (error) => Ref.set(failureRef, Option.some(error)),
        onSuccess: () => Effect.void
      }),
      Effect.ensuring(PubSub.shutdown(pubsub)),
      Effect.forkScoped
    )

    const eventStream = yield* Stream.fromPubSub(pubsub, { scoped: true })
    const failureTail = Stream.unwrap(
      Ref.get(failureRef).pipe(
        Effect.map(
          Option.match({
            onNone: () => Stream.empty,
            onSome: (error) => Stream.fail(error)
          })
        )
      )
    )

    return Stream.concat(eventStream, failureTail)
  })

/**
 * Run an optimization study and stream lifecycle events.
 *
 * @since 0.1.0
 * @category combinators
 */
export const optimizeStream = <Space extends SearchSpace.SearchSpace>(
  options: OptimizeOptionsFromSpace<Space>
): Stream.Stream<StudyEvent.StudyEvent, SearchError> =>
  Stream.unwrapScoped(
    Effect.fn("effect-search/Study.optimizeStream")(
      <CurrentSpace extends SearchSpace.SearchSpace>(
        currentOptions: OptimizeOptionsFromSpace<CurrentSpace>
      ): Effect.Effect<Stream.Stream<StudyEvent.StudyEvent, SearchError>, SearchError, Scope.Scope> =>
        streamFromExecutionPlan(
          optimizePlanFromOptions(currentOptions).pipe(
            Effect.map(
              (optimizePlan): StreamExecutionPlan<CurrentSpace> =>
                new StreamExecutionPlan({ optimizePlan, seed: Option.none() })
            )
          )
        ).pipe(Effect.provide(StudyServicesLive))
    )(options)
  )

/**
 * Resume a study from a snapshot and stream lifecycle events.
 *
 * @since 0.1.0
 * @category combinators
 */
export const resumeStream = <Space extends SearchSpace.SearchSpace>(
  options: ResumeOptionsFromSpace<Space>
): Stream.Stream<StudyEvent.StudyEvent, SearchError> =>
  Stream.unwrapScoped(
    Effect.fn("effect-search/Study.resumeStream")(
      <CurrentSpace extends SearchSpace.SearchSpace>(
        currentOptions: ResumeOptionsFromSpace<CurrentSpace>
      ): Effect.Effect<Stream.Stream<StudyEvent.StudyEvent, SearchError>, SearchError, Scope.Scope> =>
        streamFromExecutionPlan(
          resumeExecutionSeedFromOptions(currentOptions).pipe(
            Effect.map(
              ({ optimizePlan, seed }): StreamExecutionPlan<CurrentSpace> =>
                new StreamExecutionPlan({ optimizePlan, seed: Option.some(seed) })
            )
          )
        ).pipe(Effect.provide(StudyServicesLive))
    )(options)
  )

/**
 * Resume a persisted study and stream lifecycle events.
 *
 * @since 0.1.0
 * @category combinators
 */
export const resumeFromStorageStream = <Space extends SearchSpace.SearchSpace>(
  options: ResumeFromStorageOptionsFromSpace<Space>
): Stream.Stream<StudyEvent.StudyEvent, SearchError, StudyStorage> =>
  Stream.unwrapScoped(
    Effect.fn("effect-search/Study.resumeFromStorageStream")(
      <CurrentSpace extends SearchSpace.SearchSpace>(
        currentOptions: ResumeFromStorageOptionsFromSpace<CurrentSpace>
      ): Effect.Effect<Stream.Stream<StudyEvent.StudyEvent, SearchError>, SearchError, Scope.Scope | StudyStorage> =>
        streamFromExecutionPlan(
          resumeExecutionSeedFromStorageOptions(currentOptions).pipe(
            Effect.map(
              ({ optimizePlan, seed }): StreamExecutionPlan<CurrentSpace> =>
                new StreamExecutionPlan({ optimizePlan, seed: Option.some(seed) })
            )
          )
        ).pipe(Effect.provide(StudyServicesLive))
    )(options)
  )
