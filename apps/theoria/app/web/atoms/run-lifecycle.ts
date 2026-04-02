import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Clock, Deferred, Duration, Effect, Fiber, Match, Option, SynchronizedRef } from "effect"

import type { Id } from "../../contracts/id.js"

import type { RunRegistry } from "./run-registry-context.js"

type RunSignalActivity = "running" | "paused" | "stopping"

type RunSignalObserver = {
  readonly onPauseCheckpointReached: Effect.Effect<void, never, never>
}

type MakeRunSignalOptions = {
  readonly onPauseCheckpointReached?: Effect.Effect<void, never, never>
}

type RunSignalState = {
  readonly activity: RunSignalActivity
  readonly resumeGate: Option.Option<Deferred.Deferred<void, never>>
  readonly changeGate: Deferred.Deferred<void, never>
  readonly pauseCheckpointPending: boolean
}

export type RunSignal = {
  readonly observer: RunSignalObserver
  readonly stateRef: SynchronizedRef.SynchronizedRef<RunSignalState>
}

export type ActiveRun = {
  readonly token: number
  readonly sequence: number
  readonly fiber: Fiber.RuntimeFiber<void, never>
  readonly signal: RunSignal
}

type RunController = {
  readonly nextToken: number
  readonly active: Option.Option<ActiveRun>
}

const initialRunController: RunController = { nextToken: 1, active: Option.none() }

const runControllerAtom: (id: Id) => AtomType.Writable<RunController> = Atom.family((_id: Id) =>
  Atom.make(initialRunController).pipe(Atom.keepAlive)
)

const updateRunController = (
  registry: RunRegistry,
  id: Id,
  f: (controller: RunController) => RunController
): void => {
  registry.update(runControllerAtom(id), f)
}

const clearActiveRun = (registry: RunRegistry, id: Id, token: number): void => {
  updateRunController(registry, id, (controller) =>
    Option.match(controller.active, {
      onNone: () => controller,
      onSome: (active) =>
        active.token === token
          ? {
            ...controller,
            active: Option.none()
          }
          : controller
    }))
}

const activeRun = (registry: RunRegistry, id: Id): Option.Option<ActiveRun> =>
  registry.get(runControllerAtom(id)).active

const withActiveRun = <A>(
  registry: RunRegistry,
  id: Id,
  onNone: () => A,
  onSome: (active: ActiveRun) => A
): A =>
  Option.match(activeRun(registry, id), {
    onNone,
    onSome
  })

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

const makeSignalState = ({
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

const remainingSleepMs = (remainingMs: number, elapsedMs: number): number => Math.max(remainingMs - elapsedMs, 0)

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

export const makeRunSignal = (
  options: MakeRunSignalOptions = {}
): Effect.Effect<RunSignal, never, never> =>
  Effect.gen(function*() {
    const initialState = yield* makeSignalState({
      activity: "running",
      pauseCheckpointPending: false,
      resumeGate: Option.none()
    })

    return {
      observer: {
        onPauseCheckpointReached: options.onPauseCheckpointReached ?? defaultRunSignalObserver.onPauseCheckpointReached
      },
      stateRef: yield* SynchronizedRef.make(initialState)
    }
  })

export const awaitRunSignal = (signal: RunSignal): Effect.Effect<void, never, never> =>
  awaitRunningState(signal).pipe(Effect.asVoid)

export const awaitNextRunSignalChange = (signal: RunSignal): Effect.Effect<void, never, never> =>
  SynchronizedRef.get(signal.stateRef).pipe(
    Effect.flatMap((state) => Deferred.await(state.changeGate)),
    Effect.asVoid
  )

export const sleepWithRunSignal = (signal: RunSignal, ms: number): Effect.Effect<void, never, never> =>
  sleepRemainingWithRunSignal(signal, ms)

export const pauseRunSignal = (signal: RunSignal): Effect.Effect<boolean, never, never> =>
  SynchronizedRef.modifyEffect(signal.stateRef, (state) =>
    Match.value(state.activity).pipe(
      Match.when("running", () =>
        Effect.gen(function*() {
          const resumeGate = yield* Deferred.make<void, never>()
          const nextState = yield* makeSignalState({
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

export const resumeRunSignal = (signal: RunSignal): Effect.Effect<boolean, never, never> =>
  SynchronizedRef.modifyEffect(signal.stateRef, (state) =>
    Match.value(state.activity).pipe(
      Match.when("paused", () =>
        Effect.gen(function*() {
          const nextState = yield* makeSignalState({
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

export const markRunSignalStopping = (signal: RunSignal): Effect.Effect<void, never, never> =>
  SynchronizedRef.modifyEffect(signal.stateRef, (state) =>
    Match.value(state.activity).pipe(
      Match.when("stopping", () => Effect.succeed(keepRunSignalState(state))),
      Match.orElse(() =>
        Effect.gen(function*() {
          const nextState = yield* makeSignalState({
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

export const allocateRunToken = (registry: RunRegistry, id: Id): number => {
  const controller = registry.get(runControllerAtom(id))
  const token = controller.nextToken

  registry.set(runControllerAtom(id), {
    ...controller,
    nextToken: token + 1
  })

  return token
}

export const registerActiveRun = (registry: RunRegistry, id: Id, active: ActiveRun): void => {
  updateRunController(registry, id, (controller) => ({ ...controller, active: Option.some(active) }))
}

export const releaseActiveRun = (registry: RunRegistry, id: Id, token: number): void => {
  clearActiveRun(registry, id, token)
}

export const activeRunFor = (registry: RunRegistry, id: Id): Option.Option<ActiveRun> => activeRun(registry, id)

export const pauseActiveRun = (
  registry: RunRegistry,
  id: Id
): Effect.Effect<Option.Option<ActiveRun>, never, never> =>
  withActiveRun(
    registry,
    id,
    () => Effect.succeed(Option.none()),
    (active) =>
      pauseRunSignal(active.signal).pipe(
        Effect.map((changed) => (changed ? Option.some(active) : Option.none()))
      )
  )

export const resumeActiveRun = (
  registry: RunRegistry,
  id: Id
): Effect.Effect<Option.Option<ActiveRun>, never, never> =>
  withActiveRun(
    registry,
    id,
    () => Effect.succeed(Option.none()),
    (active) =>
      resumeRunSignal(active.signal).pipe(
        Effect.map((changed) => (changed ? Option.some(active) : Option.none()))
      )
  )

export const interruptActiveRun = (id: Id, registry: RunRegistry): Effect.Effect<void, never, never> =>
  withActiveRun(
    registry,
    id,
    () => Effect.void,
    (active) =>
      markRunSignalStopping(active.signal).pipe(
        Effect.zipRight(Fiber.interrupt(active.fiber)),
        Effect.ensuring(
          Effect.sync(() => {
            clearActiveRun(registry, id, active.token)
          })
        )
      )
  )

export const stopActiveRun = (
  id: Id,
  registry: RunRegistry
): Effect.Effect<Option.Option<ActiveRun>, never, never> =>
  withActiveRun(
    registry,
    id,
    () => Effect.succeed(Option.none()),
    (active) =>
      markRunSignalStopping(active.signal).pipe(
        Effect.zipRight(Fiber.interrupt(active.fiber)),
        Effect.ensuring(
          Effect.sync(() => {
            clearActiveRun(registry, id, active.token)
          })
        ),
        Effect.as(Option.some(active))
      )
  )
