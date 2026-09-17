/**
 * Optimization checkpoint specialization over generic study persistence.
 *
 * @since 0.7.0
 * @module
 */
import type { FileSystem, Path } from "@effect/platform"
import type * as Journal from "@scenesystems/effect-study/Journal"
import * as StudyStorage from "@scenesystems/effect-study/StudyStorage"
import { Array as Arr, Effect, Layer, Number as Num, Option, Schema, Tuple } from "effect"
import type * as Context from "effect/Context"

import * as OptimizationSnapshot from "./OptimizationSnapshot.js"

const Trials = Schema.Array(OptimizationSnapshot.Trial)

/** Optimization checkpoint and replay-tail policy. @since 0.7.0 @category services */
export class OptimizationStorage extends Effect.Tag("effect-search/OptimizationStorage")<
  OptimizationStorage,
  {
    readonly appendTrial: (trial: OptimizationSnapshot.Trial) => Effect.Effect<void, Journal.Failure>
    readonly writeSnapshot: (
      snapshot: OptimizationSnapshot.OptimizationSnapshot
    ) => Effect.Effect<void, Journal.Failure>
    readonly loadSnapshot: () => Effect.Effect<
      Option.Option<OptimizationSnapshot.OptimizationSnapshot>,
      Journal.Failure
    >
    readonly loadTrialLog: () => Effect.Effect<typeof Trials.Type, Journal.Failure>
    readonly replayTrialLog: () => Effect.Effect<typeof Trials.Type, Journal.Failure>
  }
>() {}

/** Optimization storage implementation. @since 0.7.0 @category models */
export type Service = Context.Tag.Service<typeof OptimizationStorage>

const specialize = (storage: StudyStorage.Service): Service => {
  const loadSnapshot = storage.loadSnapshot(OptimizationSnapshot.OptimizationSnapshot)
  const loadTrialLog = storage.loadTrialLog(OptimizationSnapshot.Trial)
  return {
    appendTrial: (trial) => storage.appendTrial(OptimizationSnapshot.Trial, trial),
    writeSnapshot: (snapshot) => storage.writeSnapshot(OptimizationSnapshot.OptimizationSnapshot, snapshot),
    loadSnapshot: () => loadSnapshot,
    loadTrialLog: () => loadTrialLog,
    replayTrialLog: () =>
      Effect.all(Tuple.make(loadSnapshot, loadTrialLog)).pipe(
        Effect.map(([snapshot, trials]) =>
          Option.match(snapshot, {
            onNone: () => trials,
            onSome: (value) =>
              Arr.filter(trials, (trial) => Num.greaterThanOrEqualTo(trial.trialNumber, value.nextTrialNumber))
          })
        )
      )
  }
}

/**
 * Specializes an ambient generic storage capability with optimization schemas and replay policy.
 *
 * @since 0.7.0
 * @category constructors
 */
export const make: Effect.Effect<Service, never, StudyStorage.StudyStorage> = StudyStorage.StudyStorage
  .pipe(Effect.map(specialize))

/**
 * Creates filesystem-backed optimization storage by delegating all persistence mechanics.
 *
 * @since 0.7.0
 * @category constructors
 */
export const makeFileSystem = (
  options: StudyStorage.FileSystemOptions
): Effect.Effect<Service, Journal.Failure, FileSystem.FileSystem | Path.Path> =>
  StudyStorage.makeFileSystem(options).pipe(Effect.map(specialize))

/** Provides optimization policy over an ambient generic storage service. @since 0.7.0 @category layers */
export const layer: Layer.Layer<OptimizationStorage, never, StudyStorage.StudyStorage> = Layer.effect(
  OptimizationStorage,
  make
)

/** Provides filesystem-backed optimization storage. @since 0.7.0 @category layers */
export const layerFileSystem = (
  options: StudyStorage.FileSystemOptions
): Layer.Layer<OptimizationStorage, Journal.Failure, FileSystem.FileSystem | Path.Path> =>
  Layer.effect(OptimizationStorage, makeFileSystem(options))

const optional = <A>(
  present: (storage: Service) => Effect.Effect<A, Journal.Failure>,
  absent: Effect.Effect<A>
): Effect.Effect<A, Journal.Failure> =>
  Effect.serviceOption(OptimizationStorage).pipe(
    Effect.flatMap(Option.match({ onNone: () => absent, onSome: present }))
  )

/** Appends only when optimization storage is present in the ambient context. @since 0.7.0 @category combinators */
export const appendIfAvailable = (trial: OptimizationSnapshot.Trial): Effect.Effect<void, Journal.Failure> =>
  optional((storage) => storage.appendTrial(trial), Effect.void)

/** Writes only when optimization storage is present in the ambient context. @since 0.7.0 @category combinators */
export const writeIfAvailable = (
  snapshot: OptimizationSnapshot.OptimizationSnapshot
): Effect.Effect<void, Journal.Failure> => optional((storage) => storage.writeSnapshot(snapshot), Effect.void)
