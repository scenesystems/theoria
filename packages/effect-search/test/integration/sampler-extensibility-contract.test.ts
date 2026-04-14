import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Match, Number as Num, Option, Stream } from "effect"
import { abs } from "effect-math/Numeric"

import { InvalidStudyConfig } from "../../src/Errors/index.js"
import { decodeSlotConfig, SlotSpace } from "../../src/experimental/scenarios/slot.js"
import { pendingAsZeroImputationPolicy } from "../../src/Sampler/index.js"
import * as Sampler from "../../src/Sampler/index.js"
import * as Study from "../../src/Study/index.js"

const extensionSpace = SlotSpace.make(64)

const asSingleObjective = (result: Study.StudyResult) =>
  result._tag === "SingleObjective" ? Option.some(result) : Option.none()

const makeExtensionSampler = (seed: number): Sampler.Sampler => ({
  kind: Sampler.Random({ options: { seed } }),
  pendingImputationPolicy: pendingAsZeroImputationPolicy,
  checkpoint: Effect.succeed({ _tag: "Random", seed }),
  restore: (checkpoint) =>
    Match.value(checkpoint).pipe(
      Match.tag("Random", ({ seed: checkpointSeed }) =>
        Match.value(seed === checkpointSeed).pipe(
          Match.when(true, () => Effect.void),
          Match.orElse(() =>
            Effect.fail(
              new InvalidStudyConfig({
                reason: `sampler-extension checkpoint mismatch: expected ${seed}, received ${checkpointSeed}`
              })
            )
          )
        )),
      Match.orElse((resolved) =>
        Effect.fail(
          new InvalidStudyConfig({
            reason: `sampler-extension checkpoint tag mismatch: expected Random, received ${resolved._tag}`
          })
        )
      )
    ),
  suggest: (_space, context) => Effect.succeed({ slot: (context.nextTrialNumber + seed) % 17 })
})

const extensionObjective = (raw: unknown) => {
  const config = decodeSlotConfig(raw)

  return Effect.succeed(abs(config.slot - 3))
}

describe("sampler extensibility debt-prevention gate", () => {
  it.effect("runs optimize and optimizeStream through sampler interface without study-internal specialization", () =>
    Effect.gen(function*() {
      const sampler = makeExtensionSampler(5)
      const optimized = yield* Study.optimize({
        space: extensionSpace,
        sampler,
        direction: "minimize",
        trials: 12,
        concurrency: 3,
        objective: extensionObjective
      })
      const resultOption = asSingleObjective(optimized)
      expect(Option.isSome(resultOption)).toBe(true)

      if (Option.isNone(resultOption)) {
        return
      }

      const result = resultOption.value
      const slots = result.trials.map((trial) => decodeSlotConfig(trial.config).slot)
      const expectedSlots = result.trials.map((trial) => (trial.trialNumber + 5) % 17)
      const expectedBest = slots.reduce(
        (best, slot) => Num.min(best, abs(slot - 3)),
        Number.POSITIVE_INFINITY
      )

      expect(result.trials.map((trial) => trial.trialNumber)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
      expect(slots).toEqual(expectedSlots)
      expect(result.bestTrial.state.value).toBe(expectedBest)

      const streamed = yield* Stream.runCollect(
        Study.optimizeStream({
          space: extensionSpace,
          sampler,
          direction: "minimize",
          trials: 12,
          concurrency: 3,
          objective: extensionObjective
        })
      )
      const tags = Chunk.toReadonlyArray(streamed).map((event) => event._tag)

      expect(tags.filter((tag) => tag === "TrialStarted")).toHaveLength(12)
      expect(tags.filter((tag) => tag === "TrialCompleted")).toHaveLength(12)
      expect(tags[tags.length - 1]).toBe("StudyCompleted")
    }))

  it.effect("supports snapshot/resume with sampler-owned checkpoint contracts", () =>
    Effect.gen(function*() {
      const baseSampler = makeExtensionSampler(7)
      const firstLeg = yield* Study.optimize({
        space: extensionSpace,
        sampler: baseSampler,
        direction: "minimize",
        trials: 7,
        objective: extensionObjective
      })
      const firstLegOption = asSingleObjective(firstLeg)
      expect(Option.isSome(firstLegOption)).toBe(true)

      if (Option.isNone(firstLegOption)) {
        return
      }

      const snapshot = yield* Study.snapshot(firstLegOption.value)
      const resumed = yield* Study.resume({
        space: extensionSpace,
        sampler: baseSampler,
        snapshot,
        direction: "minimize",
        trials: 5,
        objective: extensionObjective
      })
      const resumedOption = asSingleObjective(resumed)
      expect(Option.isSome(resumedOption)).toBe(true)

      if (Option.isNone(resumedOption)) {
        return
      }

      expect(resumedOption.value.trials).toHaveLength(12)
      expect(resumedOption.value.trials.map((trial) => trial.trialNumber)).toEqual([
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
      ])

      const mismatch = yield* Effect.either(
        Study.resume({
          space: extensionSpace,
          sampler: makeExtensionSampler(11),
          snapshot,
          direction: "minimize",
          trials: 5,
          objective: extensionObjective
        })
      )

      expect(mismatch._tag).toBe("Left")
      if (mismatch._tag === "Left") {
        expect(mismatch.left).toBeInstanceOf(InvalidStudyConfig)
      }
    }))
})
