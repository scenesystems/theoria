/** Cancellation-safe serialized access to mutable study runtime state. */
import type * as History from "@scenesystems/effect-study/History"
import * as Lifecycle from "@scenesystems/effect-study/Lifecycle"
import { Effect, Match, SubscriptionRef, Tuple } from "effect"
import type { Stream } from "effect"

import type * as Trial from "../../../Trial.js"
import { RuntimeState, type StudyRuntime } from "./bootstrap.js"

export { RuntimeState, type StudyRuntime } from "./bootstrap.js"
export { initializeRuntime, restoreRuntime } from "./bootstrap.js"

export const modifyRuntimeState = <Config, A, E, R>(
  runtime: StudyRuntime<Config>,
  run: (state: RuntimeState<Config>) => Effect.Effect<readonly [A, RuntimeState<Config>], E, R>
): Effect.Effect<A, E, R> => SubscriptionRef.modifyEffect(runtime.state, run)

export const modifyStudyState = <Config, A, E, R>(
  runtime: StudyRuntime<Config>,
  run: (
    state: History.History<Config, Trial.State>
  ) => Effect.Effect<readonly [A, History.History<Config, Trial.State>], E, R>
): Effect.Effect<A, E, R> =>
  modifyRuntimeState(runtime, (state) =>
    run(state.studyState).pipe(
      Effect.map(([response, nextStudyState]) =>
        Tuple.make(response, new RuntimeState({ lifecycle: state.lifecycle, studyState: nextStudyState }))
      )
    ))

export const readRuntimeState = <Config>(runtime: StudyRuntime<Config>): Effect.Effect<RuntimeState<Config>> =>
  SubscriptionRef.get(runtime.state)

export const readStudyState = <Config>(
  runtime: StudyRuntime<Config>
): Effect.Effect<History.History<Config, Trial.State>> =>
  readRuntimeState(runtime).pipe(Effect.map((state) => state.studyState))

export const setRuntimeLifecycle = <Config>(
  runtime: StudyRuntime<Config>,
  lifecycle: Lifecycle.Lifecycle
): Effect.Effect<void> =>
  modifyRuntimeState(runtime, (state) =>
    Match.value(Lifecycle.canTransition(state.lifecycle, lifecycle)).pipe(
      Match.when(true, () =>
        Effect.succeed(Tuple.make(undefined, new RuntimeState({ lifecycle, studyState: state.studyState })))),
      Match.orElse(() =>
        Effect.succeed(Tuple.make(undefined, state))
      )
    ))

export const runtimeChanges = <Config>(runtime: StudyRuntime<Config>): Stream.Stream<RuntimeState<Config>> =>
  runtime.state.changes

export const snapshotRuntime = <Config>(runtime: StudyRuntime<Config>): Effect.Effect<RuntimeState<Config>> =>
  readRuntimeState(runtime)
