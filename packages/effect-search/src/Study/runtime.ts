/**
 * Core study runtime loop orchestrating trial scheduling, evaluation, and completion.
 *
 * @since 0.1.0
 */
import { Array as Arr, Cause, Effect, Match, Number as Num, Option, Queue, Ref } from "effect"
import type { Scope } from "effect"

import type { SearchError } from "../Errors/index.js"
import * as Sampler from "../Sampler/index.js"
import type * as Scheduler from "../Scheduler/index.js"
import type * as SearchSpace from "../SearchSpace/index.js"
import * as StudyEvent from "../StudyEvent/index.js"
import type { EventPublisher } from "./events.js"
import { appendEvent, noopEventPublisher } from "./events.js"
import type { ObjectiveEvaluator } from "./objectiveEvaluator.js"
import {
  normalizeSettings,
  type OptimizePlan,
  type OptimizeSettings,
  pruningPolicyFromOptions,
  validateSettings
} from "./options.js"
import { resolveCompletionReason } from "./runtime/completion.js"
import {
  type ConfigFor,
  defaultExecuteSeed,
  ExecuteOutcome,
  ExecuteSeed,
  type InterruptionSnapshotSink,
  noopInterruptionSnapshotSink
} from "./runtime/executionModel.js"
import { mergeSeedWithPriorTrials, RuntimeSeed } from "./runtime/priorSeed.js"
import type { PruningPolicy } from "./runtime/pruning.js"
import {
  initializeRuntime,
  readStudyState,
  setRuntimeLifecycle,
  StudyClock,
  StudyClockLayer,
  type StudyRuntime
} from "./runtime/runtimeState.js"
import { runSchedulerStudy } from "./runtime/scheduler.js"
import { snapshotMetadataFromOptions } from "./runtime/snapshotMetadata.js"
import { startDurationStopper } from "./runtime/stopping.js"
import { runScheduledTrial } from "./runtime/trialExecution.js"
import { trialNumbers } from "./runtime/trialSchedule.js"
import { snapshotFromTrials } from "./snapshot/versioning.js"
import { completedTrialsFromState, trialsFromState } from "./state.js"
import { writeSnapshotIfAvailable } from "./studyStorage.js"

export {
  /** @since 0.1.0 */
  defaultExecuteSeed,
  /** @since 0.1.0 */
  ExecuteOutcome,
  /** @since 0.1.0 */
  ExecuteSeed,
  /** @since 0.1.0 */
  noopInterruptionSnapshotSink,
  /** @since 0.1.0 */
  StudyClock
}
export type {
  /** @since 0.1.0 */
  InterruptionSnapshotSink,
  /** @since 0.1.0 */
  StudyRuntime
}

const persistRuntimeCheckpoint = <Space extends SearchSpace.SearchSpace>(
  options: OptimizePlan<ConfigFor<Space>, Space>,
  settings: OptimizeSettings,
  runtime: StudyRuntime<ConfigFor<Space>>,
  interruptionSnapshotSink: InterruptionSnapshotSink
): Effect.Effect<void> =>
  Effect.gen(function*() {
    const samplerCheckpoint = yield* Sampler.checkpoint(options.sampler)
    const finalState = yield* readStudyState(runtime)
    const metadata = snapshotMetadataFromOptions(options, settings, samplerCheckpoint)
    const snapshot = snapshotFromTrials(trialsFromState(finalState), metadata)
    yield* writeSnapshotIfAvailable(snapshot)
    yield* interruptionSnapshotSink(snapshot)
  }).pipe(Effect.catchAll(() => Effect.void))

const failureLifecycle = (cause: Cause.Cause<unknown>): "Cancelled" | "Failed" =>
  Cause.isInterruptedOnly(cause) ? "Cancelled" : "Failed"

const withSamplerLifecycle = <Space extends SearchSpace.SearchSpace, A, E, R>(
  options: OptimizePlan<ConfigFor<Space>, Space>,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E | SearchError, R | Scope.Scope> =>
  Effect.acquireRelease(
    Sampler.acquireLifecycle(options.sampler),
    () => Sampler.releaseLifecycle(options.sampler)
  ).pipe(Effect.zipRight(effect))

const runTrialWorker = <Space extends SearchSpace.SearchSpace>(
  workQueue: Queue.Dequeue<number>,
  options: OptimizePlan<ConfigFor<Space>, Space>,
  settings: OptimizeSettings,
  runtime: StudyRuntime<ConfigFor<Space>>,
  pruningPolicy: PruningPolicy
): Effect.Effect<void, SearchError, StudyClock | ObjectiveEvaluator> =>
  Effect.suspend(() =>
    Queue.poll(workQueue).pipe(
      Effect.flatMap(
        Option.match({
          onNone: () => Effect.void,
          onSome: (trialNumber) =>
            runScheduledTrial(options, settings, pruningPolicy, trialNumber, runtime).pipe(
              Effect.zipRight(runTrialWorker(workQueue, options, settings, runtime, pruningPolicy))
            )
        })
      )
    )
  )

const executeQueuedTrials = <Space extends SearchSpace.SearchSpace>(
  options: OptimizePlan<ConfigFor<Space>, Space>,
  settings: OptimizeSettings,
  runtime: StudyRuntime<ConfigFor<Space>>,
  pruningPolicy: PruningPolicy,
  startTrialNumber: number
): Effect.Effect<void, SearchError, StudyClock | ObjectiveEvaluator | Scope.Scope> =>
  Effect.gen(function*() {
    const queueCapacity = Num.max(settings.trials, 1)
    const workQueue = yield* Queue.bounded<number>(queueCapacity)
    yield* Effect.addFinalizer(() => Queue.shutdown(workQueue))
    yield* Queue.offerAll(workQueue, trialNumbers(settings.trials, startTrialNumber)).pipe(Effect.asVoid)

    yield* Effect.forEach(
      Arr.makeBy(settings.concurrency, (index) => index),
      () => runTrialWorker(workQueue, options, settings, runtime, pruningPolicy),
      {
        discard: true,
        concurrency: settings.concurrency
      }
    )
  })

/**
 * Runs a full optimization study from initialization through trial scheduling to completion, returning the outcome.
 *
 * @since 0.1.0
 * @category utils
 */
export const executeStudy = <Space extends SearchSpace.SearchSpace>(
  options: OptimizePlan<SearchSpace.Type<Space>, Space>,
  seed: ExecuteSeed<SearchSpace.Type<Space>> = defaultExecuteSeed<SearchSpace.Type<Space>>(),
  eventPublisher: EventPublisher = noopEventPublisher,
  interruptionSnapshotSink: InterruptionSnapshotSink = noopInterruptionSnapshotSink
): Effect.Effect<ExecuteOutcome<SearchSpace.Type<Space>>, SearchError, ObjectiveEvaluator> =>
  Effect.scoped(
    withSamplerLifecycle(
      options,
      Effect.gen(function*() {
        const settings = normalizeSettings(options)
        const pruningPolicy = pruningPolicyFromOptions(options)
        yield* validateSettings(settings)
        const runtimeSeed = yield* mergeSeedWithPriorTrials(
          options,
          settings.objectiveSpec,
          new RuntimeSeed({
            initialTrials: seed.initialTrials,
            startTrialNumber: seed.startTrialNumber
          })
        )
        const samplerCheckpoint = yield* Sampler.SamplerSpi.pipe(
          Effect.flatMap(({ checkpoint }) => checkpoint),
          Effect.provide(Sampler.SamplerSpiLayer(options.sampler))
        )
        const snapshotMetadata = snapshotMetadataFromOptions(options, settings, samplerCheckpoint)

        const runtime = yield* initializeRuntime(settings, runtimeSeed.initialTrials, eventPublisher)
        yield* setRuntimeLifecycle(runtime, "Running")
        yield* startDurationStopper(settings, runtime)

        yield* Effect.addFinalizer((exit) =>
          Match.value(exit).pipe(
            Match.tag("Success", () => Effect.void),
            Match.tag("Failure", ({ cause }) =>
              setRuntimeLifecycle(runtime, failureLifecycle(cause)).pipe(
                Effect.zipRight(persistRuntimeCheckpoint(options, settings, runtime, interruptionSnapshotSink))
              )),
            Match.exhaustive
          )
        )

        const schedulerSummary = yield* Option.fromNullable(options.scheduler).pipe(
          Option.match({
            onNone: () =>
              executeQueuedTrials(options, settings, runtime, pruningPolicy, runtimeSeed.startTrialNumber).pipe(
                Effect.as(Option.none<Scheduler.SchedulerSummary>())
              ),
            onSome: () =>
              runSchedulerStudy(options, settings, runtime, pruningPolicy, runtimeSeed.startTrialNumber).pipe(
                Effect.map(Option.some)
              )
          })
        )

        const finalState = yield* readStudyState(runtime)
        const stopRequest = yield* Ref.get(runtime.stopRef.ref)
        const completionReasonOverride = yield* Ref.get(runtime.completionReasonRef)
        const trials = trialsFromState(finalState)
        const completionReason = resolveCompletionReason(stopRequest, completionReasonOverride)
        const completionSnapshot = snapshotFromTrials(trials, snapshotMetadata)

        yield* setRuntimeLifecycle(runtime, "Completed")
        yield* appendEvent(runtime, StudyEvent.StudyCompleted.make({ completionReason }))
        yield* writeSnapshotIfAvailable(completionSnapshot)

        return new ExecuteOutcome({
          snapshotMetadata,
          objectiveSpec: settings.objectiveSpec,
          epsilon: settings.epsilon,
          trials,
          completed: completedTrialsFromState(finalState),
          completionReason,
          ...Option.match(schedulerSummary, {
            onNone: () => ({}),
            onSome: (summary) => ({ schedulerSummary: summary })
          })
        })
      }).pipe(Effect.provide(StudyClockLayer))
    )
  )
