import { Clock, Data, Deferred, Duration, Effect, Match, Option, SynchronizedRef } from "effect"
type RunSignalActivity = "running" | "paused" | "stopping"
export type RunSignalObserver = {
  readonly onPauseCheckpointReached: Effect.Effect<void, never, never>
}
export type RunSignalAllocationOptions = {
  readonly onPauseCheckpointReached?: Effect.Effect<void, never, never>
}
type RunSignalState = {
  readonly activity: RunSignalActivity
  readonly resumeGate: Option.Option<Deferred.Deferred<void, never>>
  readonly changeGate: Deferred.Deferred<void, never>
  readonly pauseCheckpointPending: boolean
}
type RunSignalTransition = {
  readonly changeGate: Option.Option<Deferred.Deferred<void, never>>
  readonly resumeGate: Option.Option<Deferred.Deferred<void, never>>
}
type RunSignalUpdate = {
  readonly changed: boolean
  readonly transition: RunSignalTransition
}
const noRunSignalTransition: RunSignalTransition = {
  changeGate: Option.none(),
  resumeGate: Option.none()
}
const unchangedRunSignalUpdate: RunSignalUpdate = {
  changed: false,
  transition: noRunSignalTransition
}
const defaultRunSignalObserver: RunSignalObserver = {
  onPauseCheckpointReached: Effect.void
}
const completeGate = (gate: Deferred.Deferred<void, never>): Effect.Effect<void, never, never> =>
  Deferred.succeed(gate, undefined).pipe(Effect.asVoid)
const completeOptionalGate = (
  gate: Option.Option<Deferred.Deferred<void, never>>
): Effect.Effect<void, never, never> =>
  Option.match(gate, {
    onNone: () => Effect.void,
    onSome: completeGate
  })
const notifyRunSignalUpdate = (update: RunSignalUpdate): Effect.Effect<boolean, never, never> =>
  completeOptionalGate(update.transition.changeGate).pipe(
    Effect.zipRight(completeOptionalGate(update.transition.resumeGate)),
    Effect.as(update.changed)
  )
const runSignalTransitionResult = (
  update: RunSignalUpdate,
  nextState: RunSignalState
): readonly [RunSignalUpdate, RunSignalState] => [update, nextState]
const keepRunSignalState = (state: RunSignalState): readonly [RunSignalUpdate, RunSignalState] =>
  runSignalTransitionResult(unchangedRunSignalUpdate, state)
const changedRunSignalUpdate = (transition: RunSignalTransition): RunSignalUpdate => ({
  changed: true,
  transition
})
const keepObservedRunSignalState = (state: RunSignalState): readonly [RunSignalState, RunSignalState] => [state, state]
const allocateRunSignalState = ({
  activity,
  pauseCheckpointPending,
  resumeGate
}: {
  readonly activity: RunSignalActivity
  readonly pauseCheckpointPending: boolean
  readonly resumeGate: Option.Option<Deferred.Deferred<void, never>>
}): Effect.Effect<RunSignalState, never, never> =>
  Deferred.make<void, never>().pipe(
    Effect.map((changeGate): RunSignalState => ({
      activity,
      pauseCheckpointPending,
      resumeGate,
      changeGate
    }))
  )
const observePauseCheckpoint = (signal: RunSignal): Effect.Effect<RunSignalState, never, never> =>
  SynchronizedRef.modifyEffect(signal.stateRef, (state) =>
    Match.value(state.activity).pipe(
      Match.when("paused", () =>
        state.pauseCheckpointPending
          ? signal.observer.onPauseCheckpointReached.pipe(
            Effect.as(
              keepObservedRunSignalState({
                ...state,
                pauseCheckpointPending: false
              })
            )
          )
          : Effect.succeed(keepObservedRunSignalState(state))),
      Match.orElse(() => Effect.succeed(keepObservedRunSignalState(state)))
    ))
const awaitRunningState = (signal: RunSignal): Effect.Effect<RunSignalState, never, never> =>
  observePauseCheckpoint(signal).pipe(
    Effect.flatMap((state) =>
      Match.value(state.activity).pipe(
        Match.when("running", () => Effect.succeed(state)),
        Match.when("paused", () =>
          Option.match(state.resumeGate, {
            onNone: () => awaitRunningState(signal),
            onSome: (gate) => Deferred.await(gate).pipe(Effect.zipRight(awaitRunningState(signal)))
          })),
        Match.orElse(() => Effect.interrupt)
      )
    )
  )
const remainingSleepMs = (remainingMs: number, elapsedMs: number): number => Math.max(remainingMs - elapsedMs, 0)
const projectionFrameIntervalMs = 16
const sleepRemainingWithRunSignal = (signal: RunSignal, remainingMs: number): Effect.Effect<void, never, never> =>
  remainingMs <= 0
    ? Effect.void
    : Effect.gen(function*() {
      const state = yield* awaitRunningState(signal)
      const startedAt = yield* Clock.currentTimeMillis
      yield* Effect.raceFirst(
        Effect.sleep(Duration.millis(remainingMs)),
        Deferred.await(state.changeGate)
      )
      const endedAt = yield* Clock.currentTimeMillis
      return yield* sleepRemainingWithRunSignal(signal, remainingSleepMs(remainingMs, endedAt - startedAt))
    })
export class RunSignal extends Data.Class<RunSignal.Shape> {
  static make(signal: RunSignal.Shape): RunSignal {
    return new RunSignal(signal)
  }
  static allocate(
    options: RunSignalAllocationOptions = {}
  ): Effect.Effect<RunSignal, never, never> {
    return Effect.gen(function*() {
      const initialState = yield* allocateRunSignalState({
        activity: "running",
        pauseCheckpointPending: false,
        resumeGate: Option.none()
      })
      return RunSignal.make({
        observer: {
          onPauseCheckpointReached: options.onPauseCheckpointReached
            ?? defaultRunSignalObserver.onPauseCheckpointReached
        },
        stateRef: yield* SynchronizedRef.make(initialState)
      })
    })
  }
  awaitRunning(): Effect.Effect<void, never, never> {
    return awaitRunningState(this).pipe(Effect.asVoid)
  }
  awaitNextChange(): Effect.Effect<void, never, never> {
    return SynchronizedRef.get(this.stateRef).pipe(
      Effect.flatMap((state) => Deferred.await(state.changeGate)),
      Effect.asVoid
    )
  }
  sleep(ms: number): Effect.Effect<void, never, never> {
    return sleepRemainingWithRunSignal(this, ms)
  }
  yieldProjectionFrame(): Effect.Effect<void, never, never> {
    return this.sleep(projectionFrameIntervalMs)
  }
  pause(): Effect.Effect<boolean, never, never> {
    return SynchronizedRef.modifyEffect(this.stateRef, (state) =>
      Match.value(state.activity).pipe(
        Match.when("running", () =>
          Effect.gen(function*() {
            const resumeGate = yield* Deferred.make<void, never>()
            const nextState = yield* allocateRunSignalState({
              activity: "paused",
              pauseCheckpointPending: true,
              resumeGate: Option.some(resumeGate)
            })
            return runSignalTransitionResult(
              changedRunSignalUpdate({ changeGate: Option.some(state.changeGate), resumeGate: Option.none() }),
              nextState
            )
          })),
        Match.orElse(() => Effect.succeed(keepRunSignalState(state)))
      )).pipe(Effect.flatMap(notifyRunSignalUpdate))
  }
  resume(): Effect.Effect<boolean, never, never> {
    return SynchronizedRef.modifyEffect(this.stateRef, (state) =>
      Match.value(state.activity).pipe(
        Match.when("paused", () =>
          Effect.gen(function*() {
            const nextState = yield* allocateRunSignalState({
              activity: "running",
              pauseCheckpointPending: false,
              resumeGate: Option.none()
            })
            return runSignalTransitionResult(
              changedRunSignalUpdate({ changeGate: Option.some(state.changeGate), resumeGate: state.resumeGate }),
              nextState
            )
          })),
        Match.orElse(() => Effect.succeed(keepRunSignalState(state)))
      )).pipe(Effect.flatMap(notifyRunSignalUpdate))
  }
  markStopping(): Effect.Effect<void, never, never> {
    return SynchronizedRef.modifyEffect(this.stateRef, (state) =>
      Match.value(state.activity).pipe(
        Match.when("stopping", () => Effect.succeed(keepRunSignalState(state))),
        Match.orElse(() =>
          Effect.gen(function*() {
            const nextState = yield* allocateRunSignalState({
              activity: "stopping",
              pauseCheckpointPending: false,
              resumeGate: Option.none()
            })
            return runSignalTransitionResult(
              changedRunSignalUpdate({ changeGate: Option.some(state.changeGate), resumeGate: state.resumeGate }),
              nextState
            )
          })
        )
      )).pipe(Effect.flatMap(notifyRunSignalUpdate), Effect.asVoid)
  }
}
export namespace RunSignal {
  export interface Shape {
    readonly observer: RunSignalObserver
    readonly stateRef: SynchronizedRef.SynchronizedRef<RunSignalState>
  }
}
