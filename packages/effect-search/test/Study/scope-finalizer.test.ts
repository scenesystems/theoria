import { describe, expect, it } from "@effect/vitest"
import { Data, Effect, Option, Ref, Schema } from "effect"

import { noPendingImputationPolicy } from "../../src/Sampler/index.js"
import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"

const makeSpace = () =>
  SearchSpace.unsafeMake({
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
        space: makeSpace(),
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
        space: makeSpace(),
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

  it.live("persists a restorable interruption snapshot from executeStudy finalizer", () =>
    Effect.gen(function*() {
      const checkpointCallsRef = yield* Ref.make(0)
      const interruptionSnapshotRef = yield* Ref.make<Option.Option<Study.StudySnapshot>>(Option.none())
      const sampler = trackedSampler(trackedRefs(checkpointCallsRef))
      const studyKernel = yield* Study.StudyKernel
      const optimizePlan = yield* Study.optimizePlanFromOptions({
        space: makeSpace(),
        sampler,
        direction: "minimize",
        trials: 40,
        concurrency: 2,
        objective: () => Effect.sleep("20 millis").pipe(Effect.as(1))
      })
      const interrupted = yield* studyKernel.execute(
        new Study.ExecuteRequest({
          options: optimizePlan,
          seed: Option.none(),
          eventPublisher: Option.none(),
          interruptionSnapshotSink: (snapshot) => Ref.set(interruptionSnapshotRef, Option.some(snapshot))
        })
      ).pipe(Effect.timeoutOption("40 millis"))

      expect(Option.isNone(interrupted)).toBe(true)

      const interruptionSnapshot = yield* Ref.get(interruptionSnapshotRef)
      expect(Option.isSome(interruptionSnapshot)).toBe(true)

      if (Option.isNone(interruptionSnapshot)) {
        return
      }

      const resumed = yield* Study.resume({
        space: makeSpace(),
        sampler,
        snapshot: interruptionSnapshot.value,
        direction: "minimize",
        trials: 2,
        objective: () => Effect.succeed(1)
      })
      const resumedSingle = resumed._tag === "SingleObjective" ? Option.some(resumed) : Option.none()

      expect(Option.isSome(resumedSingle)).toBe(true)

      if (Option.isNone(resumedSingle)) {
        return
      }

      expect(resumedSingle.value.trials.length).toBeGreaterThanOrEqual(2)
    }).pipe(Effect.provide(Study.StudyServicesLive)))

  it.live("drains heterogeneous trial durations without starvation", () =>
    Effect.gen(function*() {
      const checkpointCallsRef = yield* Ref.make(0)
      const space = makeSpace()
      const decode = Schema.decodeUnknownSync(space.schema)
      const result = yield* Study.optimize({
        space,
        sampler: trackedSampler(trackedRefs(checkpointCallsRef)),
        direction: "maximize",
        trials: 8,
        concurrency: 3,
        objective: (raw) => {
          const config = decode(raw)
          const delay = config.slot === 0 ? "60 millis" : "5 millis"

          return Effect.sleep(delay).pipe(Effect.as(config.slot))
        }
      })
      const single = result._tag === "SingleObjective" ? Option.some(result) : Option.none()

      expect(Option.isSome(single)).toBe(true)

      if (Option.isNone(single)) {
        return
      }

      expect(single.value.trials).toHaveLength(8)
      expect(single.value.trials.map((trial) => trial.trialNumber)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
      expect(single.value.trials.every((trial) => trial.state._tag === "Completed")).toBe(true)
    }))
})
