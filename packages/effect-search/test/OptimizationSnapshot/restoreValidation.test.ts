import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Either, Match, Number as Num, Schema } from "effect"

import type { Direction } from "../../src/Direction.js"
import * as Optimization from "../../src/Optimization.js"
import * as OptimizationSnapshot from "../../src/OptimizationSnapshot.js"
import * as Sampler from "../../src/Sampler.js"
import { InvalidOptimizationConfig } from "../../src/SearchError.js"
import {
  incompatibleSnapshotSpace,
  snapshotObjectiveVector,
  snapshotSingleObjective,
  snapshotSingleObjectiveResult,
  snapshotSpace
} from "../helpers/optimizationSnapshots.js"

const expectInvalidOptimizationConfig = (outcome: Either.Either<unknown, unknown>, reasonFragment: string) =>
  Either.match(outcome, {
    onLeft: (failure) =>
      Schema.decodeUnknown(InvalidOptimizationConfig)(failure).pipe(
        Effect.tap((error) =>
          Effect.sync(() => {
            expect(error).toBeInstanceOf(InvalidOptimizationConfig)
            expect(error._tag).toBe("effect-search/InvalidOptimizationConfig")
            expect(error.reason).toContain(reasonFragment)
          })
        )
      ),
    onRight: () => Effect.dieMessage(`Expected InvalidOptimizationConfig containing "${reasonFragment}"`)
  })

describe("Optimization snapshot-resume validation boundaries", () => {
  it.effect("fails resume when snapshot and runtime spaces have different fingerprints", () =>
    Effect.gen(function*() {
      const snapshotResult = yield* Optimization.run({
        space: yield* snapshotSpace,
        sampler: Sampler.random({ seed: 712 }),
        direction: "minimize",
        trials: 3,
        objective: snapshotSingleObjective
      })

      const single = yield* snapshotSingleObjectiveResult(snapshotResult)

      const snapshot = yield* Optimization.snapshot(single)
      const outcome = yield* Effect.either(
        Optimization.resume({
          space: yield* incompatibleSnapshotSpace,
          sampler: Sampler.random({ seed: 712 }),
          snapshot,
          direction: "minimize",
          trials: 1,
          objective: snapshotSingleObjective
        })
      )

      yield* expectInvalidOptimizationConfig(outcome, "space fingerprint")
    }))

  it.effect("fails resume when sampler kind does not match snapshot sampler", () =>
    Effect.gen(function*() {
      const snapshotResult = yield* Optimization.run({
        space: yield* snapshotSpace,
        sampler: Sampler.tpe({ seed: 41, nStartupTrials: 2, nEiCandidates: 8 }),
        direction: "minimize",
        trials: 6,
        objective: snapshotSingleObjective
      })

      const single = yield* snapshotSingleObjectiveResult(snapshotResult)

      const snapshot = yield* Optimization.snapshot(single)
      const outcome = yield* Effect.either(
        Optimization.resume({
          space: yield* snapshotSpace,
          sampler: Sampler.random({ seed: 41 }),
          snapshot,
          direction: "minimize",
          trials: 3,
          objective: snapshotSingleObjective
        })
      )

      yield* expectInvalidOptimizationConfig(outcome, "sampler kind")
    }))

  it.effect("fails resume when objective spec does not match snapshot objective spec", () =>
    Effect.gen(function*() {
      const snapshotResult = yield* Optimization.run({
        space: yield* snapshotSpace,
        sampler: Sampler.random({ seed: 818 }),
        direction: "minimize",
        trials: 5,
        objective: snapshotSingleObjective
      })

      const single = yield* snapshotSingleObjectiveResult(snapshotResult)

      const snapshot = yield* Optimization.snapshot(single)
      const outcome = yield* Effect.either(
        Optimization.resume({
          space: yield* snapshotSpace,
          sampler: Sampler.random({ seed: 818 }),
          snapshot,
          directions: Arr.make<Arr.NonEmptyArray<Direction>>("minimize", "minimize"),
          trials: 2,
          objective: snapshotObjectiveVector
        })
      )

      yield* expectInvalidOptimizationConfig(outcome, "objective spec")
    }))

  it.effect("fails resume when stop mode does not match snapshot stop mode", () =>
    Effect.gen(function*() {
      const snapshotResult = yield* Optimization.run({
        space: yield* snapshotSpace,
        sampler: Sampler.random({ seed: 907 }),
        direction: "minimize",
        trials: 4,
        stopMode: "Drain",
        objective: snapshotSingleObjective
      })

      const single = yield* snapshotSingleObjectiveResult(snapshotResult)

      const snapshot = yield* Optimization.snapshot(single)
      const outcome = yield* Effect.either(
        Optimization.resume({
          space: yield* snapshotSpace,
          sampler: Sampler.random({ seed: 907 }),
          snapshot,
          direction: "minimize",
          trials: 2,
          stopMode: "Interrupt",
          objective: snapshotSingleObjective
        })
      )

      yield* expectInvalidOptimizationConfig(outcome, "stop mode")
    }))

  it.effect("fails resume when sampler checkpoint payload mismatches runtime contract", () =>
    Effect.gen(function*() {
      const snapshotResult = yield* Optimization.run({
        space: yield* snapshotSpace,
        sampler: Sampler.random({ seed: 52 }),
        direction: "minimize",
        trials: 4,
        objective: snapshotSingleObjective
      })

      const single = yield* snapshotSingleObjectiveResult(snapshotResult)

      const snapshot = yield* Optimization.snapshot(single)
      const corruptCheckpoint = Match.value(snapshot.samplerCheckpoint).pipe(
        Match.tag("Random", ({ seed }): Sampler.Checkpoint => ({ _tag: "Random", seed: Num.increment(seed) })),
        Match.tag("Grid", ({ seed, shuffle }): Sampler.Checkpoint => ({
          _tag: "Grid",
          seed: Num.increment(seed),
          shuffle
        })),
        Match.tag("Tpe", ({ seed, nStartupTrials, nEiCandidates }): Sampler.Checkpoint => ({
          _tag: "Tpe",
          seed: Num.increment(seed),
          nStartupTrials,
          nEiCandidates
        })),
        Match.tag("CmaEs", ({ seed, sigma, populationSize }): Sampler.Checkpoint => ({
          _tag: "CmaEs",
          seed: Num.increment(seed),
          sigma,
          populationSize
        })),
        Match.tag(
          "GpBo",
          ({ seed, nStartupTrials, nCandidates, lengthScale, noise, acquisition }): Sampler.Checkpoint => ({
            _tag: "GpBo",
            seed: Num.increment(seed),
            nStartupTrials,
            nCandidates,
            lengthScale,
            noise,
            acquisition
          })
        ),
        Match.exhaustive
      )
      const corruptSnapshot = new OptimizationSnapshot.OptimizationSnapshot({
        ...snapshot,
        samplerCheckpoint: corruptCheckpoint
      })

      const outcome = yield* Effect.either(
        Optimization.resume({
          space: yield* snapshotSpace,
          sampler: Sampler.random({ seed: 52 }),
          snapshot: corruptSnapshot,
          direction: "minimize",
          trials: 2,
          objective: snapshotSingleObjective
        })
      )

      yield* expectInvalidOptimizationConfig(outcome, "checkpoint mismatch")
    }))
})
