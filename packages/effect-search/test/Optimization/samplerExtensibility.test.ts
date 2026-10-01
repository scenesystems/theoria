import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Either, Equal, Match, Number as Num, Option, Stream } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import * as Optimization from "../../src/Optimization.js"
import { pendingAsZeroPolicy } from "../../src/Sampler.js"
import * as Sampler from "../../src/Sampler.js"
import { InvalidOptimizationConfig } from "../../src/SearchError.js"
import { decodeSlotConfig, makeSlotSpace } from "../fixtures/scenarios/slot.js"

const extensionSpace = makeSlotSpace(64)

const asSingleObjective = (result: Optimization.Result): Option.Option<Optimization.SingleObjectiveResult> =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", (single) => Option.some(single)),
    Match.orElse(() => Option.none())
  )

const makeExtensionSampler = (seed: number): Sampler.Sampler => ({
  kind: Sampler.Random({ options: { seed } }),
  pendingImputationPolicy: pendingAsZeroPolicy,
  checkpoint: Effect.succeed({ _tag: "Random", seed }),
  restore: (checkpoint) =>
    Match.value(checkpoint).pipe(
      Match.tag("Random", ({ seed: checkpointSeed }) =>
        Match.value(Equal.equals(seed, checkpointSeed)).pipe(
          Match.when(true, () => Effect.void),
          Match.orElse(() =>
            Effect.fail(
              new InvalidOptimizationConfig({
                reason: `sampler-extension checkpoint mismatch: expected ${seed}, received ${checkpointSeed}`
              })
            )
          )
        )),
      Match.orElse((resolved) =>
        Effect.fail(
          new InvalidOptimizationConfig({
            reason: `sampler-extension checkpoint tag mismatch: expected Random, received ${resolved._tag}`
          })
        )
      )
    ),
  suggest: (_space, context) => Effect.succeed({ slot: Num.remainder(Num.sum(context.nextTrialNumber, seed), 17) })
})

const extensionObjective = (raw: unknown) =>
  decodeSlotConfig(raw).pipe(Effect.map((config) => Numeric.abs(Num.subtract(config.slot, 3))))

describe("sampler extensibility debt-prevention gate", () => {
  it.effect("runs run and stream through sampler interface without optimization-internal specialization", () =>
    Effect.gen(function*() {
      const space = yield* extensionSpace
      const sampler = makeExtensionSampler(5)
      const optimized = yield* Optimization.run({
        space,
        sampler,
        direction: "minimize",
        trials: 12,
        concurrency: 3,
        objective: extensionObjective
      })
      const resultOption = asSingleObjective(optimized)
      expect(Option.isSome(resultOption)).toBe(true)
      const result = yield* resultOption
      const slots = yield* Effect.forEach(
        result.trials,
        (trial) => decodeSlotConfig(trial.config).pipe(Effect.map((config) => config.slot))
      )
      const expectedSlots = Arr.map(
        Arr.fromIterable(result.trials),
        (trial) => Num.remainder(Num.sum(trial.trialNumber, 5), 17)
      )
      const expectedBest = Arr.reduce(
        slots,
        Number.POSITIVE_INFINITY,
        (best, slot) => Num.min(best, Numeric.abs(Num.subtract(slot, 3)))
      )

      expect(Arr.map(Arr.fromIterable(result.trials), (trial) => trial.trialNumber)).toEqual(Arr.make(
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11
      ))
      expect(slots).toEqual(expectedSlots)
      expect(result.bestTrial.state.value).toBe(expectedBest)

      const streamed = yield* Stream.runCollect(
        Optimization.stream({
          space,
          sampler,
          direction: "minimize",
          trials: 12,
          concurrency: 3,
          objective: extensionObjective
        })
      )
      const tags = Arr.map(Chunk.toReadonlyArray(streamed), (event) => event._tag)

      expect(Arr.filter(tags, Equal.equals("TrialStarted"))).toHaveLength(12)
      expect(Arr.filter(tags, Equal.equals("TrialCompleted"))).toHaveLength(12)
      expect(Arr.last(tags)).toEqual(Option.some("Completed"))
    }))

  it.effect("supports snapshot/resume with sampler-owned checkpoint contracts", () =>
    Effect.gen(function*() {
      const space = yield* extensionSpace
      const baseSampler = makeExtensionSampler(7)
      const firstLeg = yield* Optimization.run({
        space,
        sampler: baseSampler,
        direction: "minimize",
        trials: 7,
        objective: extensionObjective
      })
      const firstLegOption = asSingleObjective(firstLeg)
      expect(Option.isSome(firstLegOption)).toBe(true)
      const first = yield* firstLegOption

      const snapshot = yield* Optimization.snapshot(first)
      const resumed = yield* Optimization.resume({
        space,
        sampler: baseSampler,
        snapshot,
        direction: "minimize",
        trials: 5,
        objective: extensionObjective
      })
      const resumedOption = asSingleObjective(resumed)
      expect(Option.isSome(resumedOption)).toBe(true)
      const completed = yield* resumedOption

      expect(completed.trials).toHaveLength(12)
      expect(Arr.map(Arr.fromIterable(completed.trials), (trial) => trial.trialNumber)).toEqual(Arr.make(
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11
      ))

      const mismatch = yield* Effect.either(
        Optimization.resume({
          space,
          sampler: makeExtensionSampler(11),
          snapshot,
          direction: "minimize",
          trials: 5,
          objective: extensionObjective
        })
      )

      expect(Either.getOrThrow(Either.flip(mismatch))).toBeInstanceOf(InvalidOptimizationConfig)
    }))
})
