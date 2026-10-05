/**
 * Optimization checkpoint specialization over generic study persistence.
 *
 * @since 0.7.0
 * @module
 */
import * as PersistenceError from "@scenesystems/effect-study/PersistenceError"
import * as StudyStorage from "@scenesystems/effect-study/StudyStorage"
import type { FileSystem, Path } from "effect"
import {
  Array as Arr,
  Context,
  Effect,
  Layer,
  Number as Num,
  Option,
  Ref,
  Schema,
  Semaphore,
  Stream,
  Tuple
} from "effect"

import * as OptimizationSnapshot from "./OptimizationSnapshot.js"

const Trials = Schema.Array(OptimizationSnapshot.Trial)

/** Optimization checkpoint and replay-tail policy. @since 0.7.0 @category services */
export class OptimizationStorage extends Context.Service<
  OptimizationStorage,
  {
    readonly appendTrial: (trial: OptimizationSnapshot.Trial) => Effect.Effect<void, PersistenceError.Failure>
    readonly writeSnapshot: (
      snapshot: OptimizationSnapshot.OptimizationSnapshot
    ) => Effect.Effect<void, PersistenceError.Failure>
    readonly loadSnapshot: (_?: void) => Effect.Effect<
      Option.Option<OptimizationSnapshot.OptimizationSnapshot>,
      PersistenceError.Failure
    >
    readonly loadTrialLog: (_?: void) => Effect.Effect<typeof Trials.Type, PersistenceError.Failure>
    readonly replayTrialLog: (_?: void) => Effect.Effect<typeof Trials.Type, PersistenceError.Failure>
  }
>()("@scenesystems/effect-search/OptimizationStorage") {}

/** Optimization storage implementation. @since 0.7.0 @category models */
export type Service = OptimizationStorage["Service"]

const specialize = (storage: StudyStorage.Service): Effect.Effect<Service, PersistenceError.Failure> =>
  Effect.gen(function*() {
    const run = yield* storage.open(
      new StudyStorage.OpenOptions({
        runId: "optimization",
        definitionDigest: "@scenesystems/effect-search/OptimizationSnapshot",
        eventSchema: OptimizationSnapshot.Trial,
        checkpointSchema: OptimizationSnapshot.OptimizationSnapshot
      })
    )
    const cursor = yield* Ref.make(yield* run.read().pipe(Stream.runFold(() => 0, (_, entry) => entry.receipt.cursor)))
    const lock = yield* Semaphore.make(1)
    const loadSnapshot = run.loadCheckpoint.pipe(Effect.map(Option.map((checkpoint) => checkpoint.state)))
    const loadTrialLog = run.read().pipe(Stream.map((entry) => entry.event), Stream.runCollect)
    return {
      appendTrial: (trial) =>
        lock.withPermit(Effect.gen(function*() {
          const receipt = yield* run.append(
            new StudyStorage.Append({
              recordId: yield* Schema.encodeEffect(Schema.FiniteFromString)(trial.trialNumber).pipe(
                Effect.mapError(PersistenceError.codec("write"))
              ),
              expectedCursor: yield* Ref.get(cursor),
              event: trial
            })
          )
          yield* Ref.update(cursor, Num.max(receipt.cursor))
        })),
      writeSnapshot: (snapshot) =>
        lock.withPermit(Effect.gen(function*() {
          yield* run.writeCheckpoint(
            new StudyStorage.CheckpointWrite({ through: yield* Ref.get(cursor), state: snapshot })
          )
        })),
      loadSnapshot: () => loadSnapshot,
      loadTrialLog: () => loadTrialLog,
      replayTrialLog: () =>
        Effect.all(Tuple.make(loadSnapshot, loadTrialLog)).pipe(
          Effect.map(([snapshot, trials]) =>
            Option.match(snapshot, {
              onNone: () => trials,
              onSome: (value) =>
                Arr.filter(trials, (trial) => Num.isGreaterThanOrEqualTo(trial.trialNumber, value.nextTrialNumber))
            })
          )
        )
    }
  })

/**
 * Opens the optimization run with Search-owned trial/checkpoint schemas and replay policy.
 * One storage location holds one optimization; trial numbers are stable record identities.
 *
 * @since 0.7.0
 * @category constructors
 */
export const make: Effect.Effect<Service, PersistenceError.Failure, StudyStorage.StudyStorage> = StudyStorage
  .StudyStorage
  .pipe(Effect.flatMap(specialize))

/**
 * Creates filesystem-backed optimization storage by delegating all persistence mechanics.
 *
 * @since 0.7.0
 * @category constructors
 */
export const makeFileSystem = (
  options: StudyStorage.FileSystemOptions
): Effect.Effect<Service, PersistenceError.Failure, FileSystem.FileSystem | Path.Path> =>
  StudyStorage.makeFileSystem(options).pipe(Effect.flatMap(specialize))

/** Provides optimization policy over an ambient generic storage service. @since 0.7.0 @category layers */
export const layer: Layer.Layer<OptimizationStorage, PersistenceError.Failure, StudyStorage.StudyStorage> = Layer
  .effect(
    OptimizationStorage,
    make
  )

/** Provides filesystem-backed optimization storage. @since 0.7.0 @category layers */
export const layerFileSystem = (
  options: StudyStorage.FileSystemOptions
): Layer.Layer<OptimizationStorage, PersistenceError.Failure, FileSystem.FileSystem | Path.Path> =>
  Layer.effect(OptimizationStorage, makeFileSystem(options))

const optional = <A>(
  present: (storage: Service) => Effect.Effect<A, PersistenceError.Failure>,
  absent: Effect.Effect<A>
): Effect.Effect<A, PersistenceError.Failure> =>
  Effect.serviceOption(OptimizationStorage).pipe(
    Effect.flatMap(Option.match({ onNone: () => absent, onSome: present }))
  )

/** Appends only when optimization storage is present in the ambient context. @since 0.7.0 @category combinators */
export const appendIfAvailable = (trial: OptimizationSnapshot.Trial): Effect.Effect<void, PersistenceError.Failure> =>
  optional((storage) => storage.appendTrial(trial), Effect.void)

/** Writes only when optimization storage is present in the ambient context. @since 0.7.0 @category combinators */
export const writeIfAvailable = (
  snapshot: OptimizationSnapshot.OptimizationSnapshot
): Effect.Effect<void, PersistenceError.Failure> => optional((storage) => storage.writeSnapshot(snapshot), Effect.void)
