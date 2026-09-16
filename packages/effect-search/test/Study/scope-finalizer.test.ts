import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Data, Effect, Layer, Match, Option, Predicate, Ref, Schema } from "effect"

import { noPendingImputationPolicy } from "../../src/Sampler/index.js"
import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study.js"
import type * as StudySnapshot from "../../src/StudySnapshot.js"
import * as StudyStorage from "../../src/StudyStorage.js"

const makeSpace = () =>
  SearchSpace.make({
    slot: SearchSpace.int(0, 100)
  })

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
    onSome: (ref) => Ref.update(ref, (calls) => calls + 1)
  })

const trackedSampler = ({
  checkpointCallsRef,
  acquireCallsRef,
  releaseCallsRef
}: SamplerTrackingRefs): Sampler.Sampler =>
  new Sampler.Sampler({
    kind: Sampler.Random({ options: {} }),
    pendingImputationPolicy: noPendingImputationPolicy,
    acquire: incrementIfPresent(acquireCallsRef),
    release: incrementIfPresent(releaseCallsRef),
    checkpoint: Ref.updateAndGet(checkpointCallsRef, (calls) => calls + 1).pipe(
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

describe("Study scoped execution", () => {
  it.live("persists sampler checkpoint through scoped finalization on interruption", () =>
    Effect.gen(function*() {
      const checkpointCallsRef = yield* Ref.make(0)
      const interrupted = yield* Study.optimize({
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
      const interrupted = yield* Study.optimize({
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
      const interruptionSnapshotRef = yield* Ref.make<Option.Option<StudySnapshot.Snapshot>>(Option.none())
      const sampler = trackedSampler(trackedRefs(checkpointCallsRef))
      const storageLayer = Layer.succeed(StudyStorage.StudyStorage, {
        appendTrial: () => Effect.void,
        writeSnapshot: (snapshot) => Ref.set(interruptionSnapshotRef, Option.some(snapshot)),
        loadSnapshot: () => Ref.get(interruptionSnapshotRef),
        loadTrialLog: () => Effect.succeed(Arr.empty()),
        replayTrialLog: () => Effect.succeed(Arr.empty())
      })
      const interrupted = yield* Study.optimize({
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

      if (Option.isNone(interruptionSnapshot)) {
        return
      }

      const resumed = yield* Study.resume({
        space: yield* makeSpace(),
        sampler,
        snapshot: interruptionSnapshot.value,
        direction: "minimize",
        trials: 2,
        objective: () => Effect.succeed(1)
      })
      const resumedSingle = Option.liftPredicate(resumed, Predicate.isTagged("SingleObjective"))

      expect(Option.isSome(resumedSingle)).toBe(true)

      if (Option.isNone(resumedSingle)) {
        return
      }

      expect(Arr.length(Arr.fromIterable(resumedSingle.value.trials))).toBeGreaterThanOrEqual(2)
    }))

  it.live("drains heterogeneous trial durations without starvation", () =>
    Effect.gen(function*() {
      const checkpointCallsRef = yield* Ref.make(0)
      const space = yield* makeSpace()
      const result = yield* Study.optimize({
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
                  Match.when(0, () => "60 millis"),
                  Match.orElse(() => "5 millis")
                )
              ).pipe(Effect.as(config.slot))
            )
          )
      })
      const single = Option.liftPredicate(result, Predicate.isTagged("SingleObjective"))

      expect(Option.isSome(single)).toBe(true)

      if (Option.isNone(single)) {
        return
      }

      const trials = Arr.fromIterable(single.value.trials)
      expect(trials).toHaveLength(8)
      expect(Arr.map(trials, (trial) => trial.trialNumber)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
      expect(Arr.every(trials, (trial) => Predicate.isTagged("Completed")(trial.state))).toBe(true)
    }))
})
