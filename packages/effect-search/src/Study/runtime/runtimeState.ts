/**
 * Serialized access to mutable study runtime state and clock time.
 *
 * @since 0.1.0
 */
import { canTransitionLifecycle, type StudyLifecycle } from "@scenesystems/effect-study/Lifecycle"
import { Clock, Effect, Layer, Match, type Schema, SubscriptionRef, Tuple } from "effect"
import type { Stream } from "effect"

import type { StudyState } from "../state.js"
import { RuntimeState, type StudyRuntime } from "./bootstrap.js"

export type { StudyLifecycle } from "@scenesystems/effect-study/Lifecycle"
export { RuntimeState, type StudyRuntime } from "./bootstrap.js"
export { initializeRuntime, restoreRuntime } from "./bootstrap.js"

/**
 * Supplies millisecond timestamps for trial start, duration, and completion
 * records. Built-in study execution uses `Clock.currentTimeMillis`; custom
 * runtime integrations can provide a deterministic implementation.
 *
 * @since 0.1.0
 * @category services
 */
export class StudyClock extends Effect.Tag("effect-search/StudyClock")<
  StudyClock,
  {
    /** Current Unix time in milliseconds. */
    readonly now: Effect.Effect<number>
  }
>() {}

/**
 * Default layer providing wall-clock time for study duration tracking.
 *
 * @since 0.1.0
 * @category layers
 */
export const StudyClockLayer = Layer.succeed(StudyClock, {
  now: Clock.currentTimeMillis
})

/**
 * Serializes a state transformation. Failure or interruption leaves the state unchanged.
 *
 * @since 0.1.0
 * @category utils
 */
export const modifyRuntimeState = <Config, A, E>(
  runtime: StudyRuntime<Config>,
  run: (state: RuntimeState<Config>) => Effect.Effect<
    Schema.Schema.Type<Schema.Tuple2<Schema.Schema<A>, Schema.Schema<RuntimeState<Config>>>>,
    E,
    StudyClock
  >
): Effect.Effect<A, E> =>
  SubscriptionRef.modifyEffect(
    runtime.state,
    (state) => run(state).pipe(Effect.provideService(StudyClock, runtime.clock))
  )

/**
 * Sends a mutation that operates on the inner StudyState while preserving the RuntimeState lifecycle.
 *
 * @since 0.1.0
 * @category utils
 */
export const modifyStudyState = <Config, A, E>(
  runtime: StudyRuntime<Config>,
  run: (state: StudyState<Config>) => Effect.Effect<
    Schema.Schema.Type<Schema.Tuple2<Schema.Schema<A>, Schema.Schema<StudyState<Config>>>>,
    E,
    StudyClock
  >
): Effect.Effect<A, E> =>
  modifyRuntimeState(runtime, (state) =>
    run(state.studyState).pipe(
      Effect.map(([response, nextStudyState]) =>
        Tuple.make(
          response,
          new RuntimeState({
            lifecycle: state.lifecycle,
            studyState: nextStudyState
          })
        )
      )
    ))

/**
 * Reads the last successfully published runtime state.
 *
 * @since 0.1.0
 * @category utils
 */
export const readRuntimeState = <Config>(runtime: StudyRuntime<Config>): Effect.Effect<RuntimeState<Config>> =>
  SubscriptionRef.get(runtime.state)

/**
 * Reads the current study state (trial data) from the runtime, discarding lifecycle metadata.
 *
 * @since 0.1.0
 * @category utils
 */
export const readStudyState = <Config>(runtime: StudyRuntime<Config>): Effect.Effect<StudyState<Config>> =>
  readRuntimeState(runtime).pipe(Effect.map((state) => state.studyState))

/**
 * Transitions the runtime lifecycle state if the transition is valid; silently ignores invalid transitions.
 *
 * @since 0.1.0
 * @category utils
 */
export const setRuntimeLifecycle = <Config>(
  runtime: StudyRuntime<Config>,
  lifecycle: StudyLifecycle
): Effect.Effect<void> =>
  modifyRuntimeState(runtime, (state) =>
    Match.value(canTransitionLifecycle(state.lifecycle, lifecycle)).pipe(
      Match.when(
        true,
        () =>
          Effect.succeed(
            Tuple.make(
              undefined,
              new RuntimeState({
                lifecycle,
                studyState: state.studyState
              })
            )
          )
      ),
      Match.when(false, () => Effect.succeed(Tuple.make(undefined, state))),
      Match.exhaustive
    ))

/**
 * Exposes the runtime state machine's change stream for reactive consumers.
 *
 * @since 0.1.0
 * @category utils
 */
export const runtimeChanges = <Config>(runtime: StudyRuntime<Config>): Stream.Stream<RuntimeState<Config>> =>
  runtime.state.changes

/**
 * Takes a point-in-time snapshot of the runtime state for persistence or diagnostics.
 *
 * @since 0.1.0
 * @category utils
 */
export const snapshotRuntime = <Config>(runtime: StudyRuntime<Config>): Effect.Effect<RuntimeState<Config>> =>
  readRuntimeState(runtime)
