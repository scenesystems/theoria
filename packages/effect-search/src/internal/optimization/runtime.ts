/**
 * Core optimization runtime loop orchestrating trial scheduling, evaluation, and completion.
 *
 * @since 0.1.0
 */
import * as History from "@scenesystems/effect-study/History"
import * as GenericStudy from "@scenesystems/effect-study/Study"
import { Array as Arr, Cause, Effect, Match, Number as Num, Option, Queue, Ref, Tuple } from "effect"
import type { Scope } from "effect"

import * as OptimizationEvent from "../../OptimizationEvent.js"
import * as OptimizationSnapshot from "../../OptimizationSnapshot.js"
import * as OptimizationStorage from "../../OptimizationStorage.js"
import type { Policy } from "../../Pruning.js"
import * as Sampler from "../../Sampler.js"
import type * as Scheduler from "../../Scheduler.js"
import type { SearchError } from "../../SearchError.js"
import type * as SearchSpace from "../../SearchSpace.js"
import type { EventPublisher } from "./events.js"
import { appendEvent, noopEventPublisher } from "./events.js"
import { cancelPendingTrials, completedTrialsFromState } from "./history.js"
import type { OptimizePlan, OptimizeSettings } from "./options/plan.js"
import { normalizeSettings, pruningPolicyFromOptions, validateSettings } from "./options/settings.js"
import { initializeRuntime, type OptimizationRuntime } from "./runtime/bootstrap.js"
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
import { runSchedulerOptimization } from "./runtime/scheduler.js"
import { snapshotMetadataFromOptions } from "./runtime/snapshotMetadata.js"
import { startDurationStopper } from "./runtime/stopping.js"
import { runScheduledTrial } from "./runtime/trialExecution.js"
import { trialNumbers } from "./runtime/trialSchedule.js"

export { defaultExecuteSeed, ExecuteOutcome, ExecuteSeed, noopInterruptionSnapshotSink }
export type { InterruptionSnapshotSink, OptimizationRuntime }

const persistRuntimeCheckpoint = <Space extends SearchSpace.SearchSpace>(
  options: OptimizePlan<ConfigFor<Space>, Space>,
  settings: OptimizeSettings,
  runtime: OptimizationRuntime<ConfigFor<Space>>,
  interruptionSnapshotSink: InterruptionSnapshotSink
): Effect.Effect<void, SearchError> =>
  Effect.gen(function*() {
    const samplerCheckpoint = yield* Sampler.checkpoint(options.sampler)
    const finalState = (yield* GenericStudy.read(runtime.study)).history
    const metadata = snapshotMetadataFromOptions(options, settings, samplerCheckpoint)
    const snapshot = OptimizationSnapshot.make(History.values(finalState), metadata)
    yield* OptimizationStorage.writeIfAvailable(snapshot)
    yield* interruptionSnapshotSink(snapshot)
  })

const failureLifecycle = (cause: Cause.Cause<unknown>): "Cancelled" | "Failed" =>
  Match.value(Cause.isInterruptedOnly(cause)).pipe(
    Match.when(true, (): "Cancelled" => "Cancelled"),
    Match.orElse((): "Failed" => "Failed")
  )

/**
 * Runs the trial phase and, when it fails or is interrupted, records the lifecycle and
 * persists a checkpoint before the failure continues. The checkpoint runs in the
 * uninterruptible region a scope finalizer would have, but keeps a typed error
 * channel: a checkpoint that cannot be written is sequenced after the original cause,
 * so the caller's `Exit` shows both the optimization's failure and the lost recovery point,
 * and typed handlers still see the optimization's failure first.
 */
const withRuntimeCheckpoint = <Space extends SearchSpace.SearchSpace, A, E, R>(
  options: OptimizePlan<ConfigFor<Space>, Space>,
  settings: OptimizeSettings,
  runtime: OptimizationRuntime<ConfigFor<Space>>,
  interruptionSnapshotSink: InterruptionSnapshotSink,
  trials: Effect.Effect<A, E, R>
): Effect.Effect<A, E | SearchError, R> =>
  Effect.uninterruptibleMask((restore) =>
    restore(trials).pipe(
      Effect.tapErrorCause((cause) =>
        GenericStudy.modify(runtime.study, (state) =>
          Effect.succeed(Tuple.make(
            undefined,
            new GenericStudy.State({ lifecycle: failureLifecycle(cause), history: cancelPendingTrials(state.history) })
          ))).pipe(
            Effect.zipRight(persistRuntimeCheckpoint(options, settings, runtime, interruptionSnapshotSink)),
            Effect.mapErrorCause((checkpointCause) => Cause.sequential(cause, checkpointCause))
          )
      )
    )
  )

const withSamplerLifecycle = <Space extends SearchSpace.SearchSpace, A, E, R>(
  options: OptimizePlan<ConfigFor<Space>, Space>,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E | SearchError, R | Scope.Scope> =>
  Effect.acquireRelease(
    Sampler.acquire(options.sampler),
    () => Sampler.release(options.sampler)
  ).pipe(Effect.zipRight(effect))

const runTrialWorker = <Space extends SearchSpace.SearchSpace>(
  workQueue: Queue.Dequeue<number>,
  options: OptimizePlan<ConfigFor<Space>, Space>,
  settings: OptimizeSettings,
  runtime: OptimizationRuntime<ConfigFor<Space>>,
  pruningPolicy: Policy
): Effect.Effect<void, SearchError> =>
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
  runtime: OptimizationRuntime<ConfigFor<Space>>,
  pruningPolicy: Policy,
  startTrialNumber: number
): Effect.Effect<void, SearchError, Scope.Scope> =>
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
 * Runs a full optimization from initialization through trial scheduling to completion, returning the outcome.
 *
 * @since 0.1.0
 * @category utils
 */
export const executeOptimization = <Space extends SearchSpace.SearchSpace>(
  options: OptimizePlan<SearchSpace.Type<Space>, Space>,
  seed: ExecuteSeed<SearchSpace.Type<Space>> = defaultExecuteSeed<SearchSpace.Type<Space>>(),
  eventPublisher: EventPublisher = noopEventPublisher,
  interruptionSnapshotSink: InterruptionSnapshotSink = noopInterruptionSnapshotSink
): Effect.Effect<ExecuteOutcome<SearchSpace.Type<Space>>, SearchError> =>
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

        const runtime = yield* initializeRuntime(settings, runtimeSeed.initialTrials, eventPublisher)
        yield* GenericStudy.transition(runtime.study, "Running")
        yield* startDurationStopper(settings, runtime)

        return yield* withRuntimeCheckpoint(
          options,
          settings,
          runtime,
          interruptionSnapshotSink,
          Effect.gen(function*() {
            const schedulerSummary = yield* Option.fromNullable(options.scheduler).pipe(
              Option.match({
                onNone: () =>
                  executeQueuedTrials(options, settings, runtime, pruningPolicy, runtimeSeed.startTrialNumber).pipe(
                    Effect.as(Option.none<Scheduler.Summary>())
                  ),
                onSome: () =>
                  runSchedulerOptimization(options, settings, runtime, pruningPolicy, runtimeSeed.startTrialNumber)
                    .pipe(
                      Effect.asSome
                    )
              })
            )

            const finalState = (yield* GenericStudy.read(runtime.study)).history
            const stopRequest = yield* Ref.get(runtime.stopRef)
            const completionReasonOverride = yield* Ref.get(runtime.completionReasonRef)
            const trials = History.values(finalState)
            const completionReason = resolveCompletionReason(stopRequest, completionReasonOverride)
            const samplerCheckpoint = yield* Sampler.checkpoint(options.sampler)
            const snapshotMetadata = snapshotMetadataFromOptions(options, settings, samplerCheckpoint)
            const completionSnapshot = OptimizationSnapshot.make(trials, snapshotMetadata)

            yield* GenericStudy.transition(runtime.study, "Completed")
            yield* appendEvent(runtime, OptimizationEvent.Completed({ completionReason }))
            yield* OptimizationStorage.writeIfAvailable(completionSnapshot)

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
          })
        )
      })
    )
  )
