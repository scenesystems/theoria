import { describe, expect, it } from "@effect/vitest"
import * as StudyStorage from "@scenesystems/effect-study/StudyStorage"
import { Array as Arr, Deferred, Effect, Fiber, Match, Number as Num, Option, Ref } from "effect"

import * as Optimization from "../../src/Optimization.js"
import * as OptimizationSnapshot from "../../src/OptimizationSnapshot.js"
import * as OptimizationStorage from "../../src/OptimizationStorage.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"

const makeStorage = StudyStorage.makeMemory().pipe(
  Effect.flatMap((storage) => OptimizationStorage.make.pipe(Effect.provideService(StudyStorage.StudyStorage, storage)))
)
const makeSpace = SearchSpace.make({ slot: SearchSpace.int(0, 10) })

describe("optimization recovery integrity", () => {
  it.effect("persists the completed sampler state for both result and storage continuation", () =>
    Effect.gen(function*() {
      const cursor = yield* Ref.make(0)
      const sampler = new Sampler.Sampler({
        kind: Sampler.Random({ options: { seed: 0 } }),
        pendingImputationPolicy: Sampler.noPendingPolicy,
        checkpoint: Ref.get(cursor).pipe(Effect.map((seed): Sampler.Checkpoint => ({ _tag: "Random", seed }))),
        restore: (checkpoint) =>
          Match.value(checkpoint).pipe(
            Match.tag("Random", ({ seed }) => Ref.set(cursor, seed)),
            Match.orElse(() => Effect.dieMessage("unexpected checkpoint"))
          ),
        suggest: () => Ref.getAndUpdate(cursor, Num.increment).pipe(Effect.map((slot) => ({ slot })))
      })
      const space = yield* makeSpace
      const storage = yield* makeStorage
      const options = {
        space,
        sampler,
        trials: 2,
        objective: ({ slot }: SearchSpace.Type<typeof space>) => Effect.succeed(slot)
      }
      const first = yield* Optimization.run(options).pipe(
        Effect.provideService(OptimizationStorage.OptimizationStorage, storage)
      )
      const snapshot = yield* Optimization.snapshot(first)
      const persisted = yield* storage.loadSnapshot().pipe(Effect.flatMap((value) => value))
      expect(snapshot.samplerCheckpoint).toEqual({ _tag: "Random", seed: 2 })
      expect(persisted.samplerCheckpoint).toEqual(snapshot.samplerCheckpoint)
      const resumed = yield* Optimization.resume({ ...options, snapshot })
      expect(Arr.map(Arr.fromIterable(resumed.trials), (trial) => trial.config.slot)).toEqual(Arr.make(0, 1, 2, 3))
    }))

  it.scoped("cancels interrupted reservations without losing completed observations", () =>
    Effect.gen(function*() {
      const ready = yield* Deferred.make<void>()
      const pending = yield* Ref.make(0)
      const storage = yield* makeStorage
      const space = yield* makeSpace
      const sampler = Sampler.grid()
      const fiber = yield* Optimization.run({
        space,
        sampler,
        trials: 3,
        concurrency: 1,
        objective: ({ slot }) =>
          Match.value(slot).pipe(
            Match.when(0, () => Effect.succeed(7)),
            Match.orElse(() =>
              Ref.update(pending, Num.increment).pipe(
                Effect.zipRight(Deferred.succeed(ready, undefined)),
                Effect.zipRight(Effect.never)
              )
            )
          )
      }).pipe(Effect.provideService(OptimizationStorage.OptimizationStorage, storage), Effect.fork)
      yield* Deferred.await(ready)
      yield* Fiber.interrupt(fiber)
      const snapshot = yield* storage.loadSnapshot().pipe(Effect.flatMap((value) => value))
      expect(yield* Ref.get(pending)).toBe(1)
      expect(Arr.map(snapshot.trials, (trial) => trial.state._tag)).toEqual(Arr.make("Completed", "Cancelled"))
      const resumed = yield* Optimization.resume({
        space,
        sampler,
        snapshot,
        trials: 1,
        objective: ({ slot }) => Effect.succeed(slot)
      })
      expect(Arr.map(Arr.fromIterable(resumed.trials), (trial) => trial.state._tag)).toEqual(
        Arr.make("Completed", "Cancelled", "Completed")
      )
      expect(Arr.map(Arr.fromIterable(resumed.trials), (trial) => trial.trialNumber)).toEqual(Arr.make(0, 1, 2))
    }))

  it.effect("pins replay filtering to the loaded checkpoint when another writer advances it", () =>
    Effect.gen(function*() {
      const space = yield* makeSpace
      const sampler = Sampler.grid()
      const result = yield* Optimization.run({
        space,
        sampler,
        trials: 4,
        objective: ({ slot }) => Effect.succeed(slot)
      })
      const latest = yield* Optimization.snapshot(result)
      const earlier = OptimizationSnapshot.make(Arr.take(latest.trials, 1), latest)
      const storage = yield* makeStorage
      yield* Effect.forEach(latest.trials, storage.appendTrial, { discard: true })
      yield* storage.writeSnapshot(earlier)
      const advancing: OptimizationStorage.Service = {
        ...storage,
        loadSnapshot: () => storage.loadSnapshot().pipe(Effect.tap(() => storage.writeSnapshot(latest)))
      }
      const resumed = yield* Optimization.resumeFromStorage({
        space,
        sampler,
        trials: 0,
        objective: ({ slot }) => Effect.succeed(slot)
      }).pipe(Effect.provideService(OptimizationStorage.OptimizationStorage, advancing))
      expect(Arr.map(Arr.fromIterable(resumed.trials), (trial) => trial.config.slot)).toEqual(Arr.make(0, 1, 2, 3))
      expect(Option.isSome(yield* storage.loadSnapshot())).toBe(true)
    }))
})
