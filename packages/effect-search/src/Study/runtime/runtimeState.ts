/**
 * Study runtime state machine operations — read, modify, and lifecycle transitions.
 *
 * @since 0.1.0
 */
import { Clock, Effect, Layer, Match, Tuple } from "effect"
import type { Stream } from "effect"

import type { StudyState } from "../state.js"
import { runtimeMutation, RuntimeState, type StudyRuntime } from "./bootstrap.js"
import { canTransitionLifecycle, type StudyLifecycle } from "./lifecycle.js"
import { SuggestionState } from "./suggestionState.js"

export {
  /** @since 0.1.0 */
  RuntimeState,
  /** @since 0.1.0 */
  type StudyRuntime
} from "./bootstrap.js"
export {
  /** @since 0.1.0 */
  initializeRuntime,
  /** @since 0.1.0 */
  restoreRuntime,
  /** @since 0.1.0 */
  type RuntimeActor
} from "./bootstrap.js"
export type {
  /** @since 0.1.0 */
  StudyLifecycle
} from "./lifecycle.js"

/**
 * Clock service for study time.
 *
 * @since 0.1.0
 * @category services
 */
export class StudyClock extends Effect.Tag("effect-search/StudyClock")<
  StudyClock,
  {
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
 * Sends a mutation to the runtime state machine, applying a function that transforms the state and produces a result.
 *
 * @since 0.1.0
 * @category utils
 */
export const modifyRuntimeState = <Config, A, E>(
  runtime: StudyRuntime<Config>,
  run: (state: RuntimeState<Config>) => Effect.Effect<readonly [A, RuntimeState<Config>], E, StudyClock>
): Effect.Effect<A, E> => runtime.stateActor.send(runtimeMutation(run))

/**
 * Sends a mutation that operates on the inner StudyState while preserving the RuntimeState lifecycle.
 *
 * @since 0.1.0
 * @category utils
 */
export const modifyStudyState = <Config, A, E>(
  runtime: StudyRuntime<Config>,
  run: (state: StudyState<Config>) => Effect.Effect<readonly [A, StudyState<Config>], E, StudyClock>
): Effect.Effect<A, E> =>
  modifyRuntimeState(runtime, (state) =>
    run(state.studyState).pipe(
      Effect.map(([response, nextStudyState]) =>
        Tuple.make(
          response,
          new RuntimeState({
            lifecycle: state.lifecycle,
            studyState: nextStudyState,
            suggestionState: SuggestionState.fromStudyState(
              state.suggestionState.objectiveSpec,
              nextStudyState,
              state.suggestionState.priorWeight,
              state.suggestionState.epsilon
            )
          })
        )
      )
    ))

/**
 * Reads the current runtime state snapshot from the state machine actor.
 *
 * @since 0.1.0
 * @category utils
 */
export const readRuntimeState = <Config>(runtime: StudyRuntime<Config>): Effect.Effect<RuntimeState<Config>> =>
  runtime.stateActor.get

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
                studyState: state.studyState,
                suggestionState: state.suggestionState
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
  runtime.stateActor.changes

/**
 * Takes a point-in-time snapshot of the runtime state for persistence or diagnostics.
 *
 * @since 0.1.0
 * @category utils
 */
export const snapshotRuntime = <Config>(runtime: StudyRuntime<Config>): Effect.Effect<RuntimeState<Config>> =>
  readRuntimeState(runtime)
