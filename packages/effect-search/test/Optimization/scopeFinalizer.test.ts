import { describe, expect, it } from "@effect/vitest"
import {
  Array as Arr,
  Data,
  Duration,
  Effect,
  Layer,
  Match,
  Number as Num,
  Option,
  Predicate,
  Ref,
  Schema
} from "effect"

import * as Optimization from "../../src/Optimization.js"
import type * as OptimizationSnapshot from "../../src/OptimizationSnapshot.js"
import * as OptimizationStorage from "../../src/OptimizationStorage.js"
import { noPendingPolicy } from "../../src/Sampler.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"

const makeSpace = () =>
  SearchSpace.make({
    slot: SearchSpace.int(0, 100)
  })

const asSingleObjective = (
  result: Optimization.Result
): Option.Option<Optimization.SingleObjectiveResult> =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", (single) => Option.some(single)),
    Match.orElse(() => Option.none())
  )

class SamplerTrackingRefs extends Data.Class<{
  readonly checkpointCallsRef: Ref.Ref<number>
  readonly acquireCallsRef: Option.Option<Ref.Ref<number>>
  readonly releaseCallsRef: Option.Option<Ref.Ref<number>>
}> {}

const trackedRefs = (
  checkpointCallsRef: Ref.Ref<number>,
  acquireCallsRef: Option.Option<Ref.Ref<number>> = Option.none(),
  releaseCallsRef: Option.Option<Ref.Ref<number>> = Option.none()
): SamplerTrackingRefs => new SamplerTrackingRefs({ checkpointCallsRef, acquireCallsRef, releaseCallsRef })

const incrementIfPresent = (counterRef: Option.Option<Ref.Ref<number>>): Effect.Effect<void> =>
  Option.match(counterRef, {
    onNone: () => Effect.void,
    onSome: (ref) => Ref.update(ref, Num.increment)
  })

const trackedSampler = ({
  checkpointCallsRef,
  acquireCallsRef,
  releaseCallsRef
}: SamplerTrackingRefs): Sampler.Sampler =>
  new Sampler.Sampler({
    kind: Sampler.Random({ options: {} }),
    pendingImputationPolicy: noPendingPolicy,
    acquire: incrementIfPresent(acquireCallsRef),
    release: incrementIfPresent(releaseCallsRef),
    checkpoint: Ref.updateAndGet(checkpointCallsRef, Num.increment).pipe(
      Effect.map((calls) => ({
        _tag: "Random",
        seed: calls
      }))
    ),
    restore: () => Effect.void,
    suggest: (_space, context) =>
      Effect.succeed({
        slot: context.nextTrialNumber
      })
  })

describe("Optimization scoped execution", () => {
  it.live("persists sampler checkpoint through scoped finalization on interruption", () =>
    Effect.gen(function*() {
      const checkpointCallsRef = yield* Ref.make(0)
      const interrupted = yield* Optimization.run({
        space: yield* makeSpace(),
        sampler: trackedSampler(trackedRefs(checkpointCallsRef)),
        direction: "minimize",
        trials: 40,
        concurrency: 2,
        objective: () => Effect.sleep("20 millis").pipe(Effect.as(1))
      }).pipe(Effect.timeoutOption("40 millis"))
      const checkpointCalls = yield* Ref.get(checkpointCallsRef)

      expect(Option.isNone(interrupted)).toBe(true)
      expect(checkpointCalls).toBeGreaterThanOrEqual(2)
    }))

  it.live("runs sampler acquire/release lifecycle in scoped execution", () =>
    Effect.gen(function*() {
      const checkpointCallsRef = yield* Ref.make(0)
      const acquireCallsRef = yield* Ref.make(0)
      const releaseCallsRef = yield* Ref.make(0)
      const interrupted = yield* Optimization.run({
        space: yield* makeSpace(),
        sampler: trackedSampler(
          trackedRefs(checkpointCallsRef, Option.some(acquireCallsRef), Option.some(releaseCallsRef))
        ),
        direction: "minimize",
        trials: 40,
        concurrency: 2,
        objective: () => Effect.sleep("20 millis").pipe(Effect.as(1))
      }).pipe(Effect.timeoutOption("40 millis"))

      expect(Option.isNone(interrupted)).toBe(true)
      expect(yield* Ref.get(acquireCallsRef)).toBe(1)
      expect(yield* Ref.get(releaseCallsRef)).toBe(1)
    }))

  it.live("persists a restorable interruption snapshot through ambient optional storage", () =>
    Effect.gen(function*() {
      const checkpointCallsRef = yield* Ref.make(0)
      const interruptionSnapshotRef = yield* Ref.make<Option.Option<OptimizationSnapshot.OptimizationSnapshot>>(
        Option.none()
      )
      const sampler = trackedSampler(trackedRefs(checkpointCallsRef))
      const storageLayer = Layer.succeed(OptimizationStorage.OptimizationStorage, {
        appendTrial: () => Effect.void,
        writeSnapshot: (snapshot) => Ref.set(interruptionSnapshotRef, Option.some(snapshot)),
        loadSnapshot: () => Ref.get(interruptionSnapshotRef),
        loadTrialLog: () => Effect.succeed(Arr.empty()),
        replayTrialLog: () => Effect.succeed(Arr.empty())
      })
      const interrupted = yield* Optimization.run({
        space: yield* makeSpace(),
        sampler,
        direction: "minimize",
        trials: 40,
        concurrency: 2,
        objective: () => Effect.sleep("20 millis").pipe(Effect.as(1))
      }).pipe(Effect.provide(storageLayer), Effect.timeoutOption("40 millis"))

      expect(Option.isNone(interrupted)).toBe(true)

      const interruptionSnapshot = yield* Ref.get(interruptionSnapshotRef)
      expect(Option.isSome(interruptionSnapshot)).toBe(true)
      const snapshot = yield* interruptionSnapshot

      const resumed = yield* Optimization.resume({
        space: yield* makeSpace(),
        sampler,
        snapshot,
        direction: "minimize",
        trials: 2,
        objective: () => Effect.succeed(1)
      })
      const resumedSingle = asSingleObjective(resumed)

      expect(Option.isSome(resumedSingle)).toBe(true)
      const completed = yield* resumedSingle

      expect(Arr.length(Arr.fromIterable(completed.trials))).toBeGreaterThanOrEqual(2)
    }))

  it.live("drains heterogeneous trial durations without starvation", () =>
    Effect.gen(function*() {
      const checkpointCallsRef = yield* Ref.make(0)
      const space = yield* makeSpace()
      const result = yield* Optimization.run({
        space,
        sampler: trackedSampler(trackedRefs(checkpointCallsRef)),
        direction: "maximize",
        trials: 8,
        concurrency: 3,
        objective: (raw) =>
          Schema.decodeUnknown(space.schema)(raw).pipe(
            Effect.flatMap((config) =>
              Effect.sleep(
                Match.value(config.slot).pipe(
                  Match.when(0, () => Duration.millis(60)),
                  Match.orElse(() => Duration.millis(5))
                )
              ).pipe(Effect.as(config.slot))
            )
          )
      })
      const single = asSingleObjective(result)

      expect(Option.isSome(single)).toBe(true)
      const completed = yield* single

      const trials = Arr.fromIterable(completed.trials)
      expect(trials).toHaveLength(8)
      expect(Arr.map(trials, (trial) => trial.trialNumber)).toEqual(Arr.make(0, 1, 2, 3, 4, 5, 6, 7))
      expect(Arr.every(trials, (trial) => Predicate.isTagged("Completed")(trial.state))).toBe(true)
    }))
})
