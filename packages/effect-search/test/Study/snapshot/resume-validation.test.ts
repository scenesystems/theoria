import { describe, expect, it } from "@effect/vitest"
import { Effect, Either, Match, Option } from "effect"

import { InvalidStudyConfig } from "../../../src/Errors/index.js"
import * as Sampler from "../../../src/Sampler/index.js"
import * as Study from "../../../src/Study/index.js"
import { asSingleObjective, makeIncompatibleSpace, makeSpace, objectiveVector, singleObjective } from "./helpers.js"

describe("Study snapshot-resume validation boundaries", () => {
  it.effect("fails resume when snapshot and runtime spaces have different fingerprints", () =>
    Effect.gen(function*() {
      const snapshotResult = yield* Study.optimize({
        space: makeSpace(),
        sampler: Sampler.random({ seed: 712 }),
        direction: "minimize",
        trials: 3,
        objective: singleObjective
      })

      const single = asSingleObjective(snapshotResult)
      expect(Option.isSome(single)).toBe(true)

      if (Option.isNone(single)) {
        return
      }

      const snapshot = yield* Study.snapshot(single.value)
      const outcome = yield* Effect.either(
        Study.resume({
          space: makeIncompatibleSpace(),
          sampler: Sampler.random({ seed: 712 }),
          snapshot,
          direction: "minimize",
          trials: 1,
          objective: singleObjective
        })
      )

      expect(Either.isLeft(outcome)).toBe(true)

      if (Either.isRight(outcome)) {
        return
      }

      expect(outcome.left).toBeInstanceOf(InvalidStudyConfig)
      expect(outcome.left._tag).toBe("effect-search/InvalidStudyConfig")

      if (outcome.left._tag !== "effect-search/InvalidStudyConfig") {
        return
      }

      expect(outcome.left.reason).toContain("space fingerprint")
    }))

  it.effect("fails resume when sampler kind does not match snapshot sampler", () =>
    Effect.gen(function*() {
      const snapshotResult = yield* Study.optimize({
        space: makeSpace(),
        sampler: Sampler.tpe({ seed: 41, nStartupTrials: 2, nEiCandidates: 8 }),
        direction: "minimize",
        trials: 6,
        objective: singleObjective
      })

      const single = asSingleObjective(snapshotResult)
      expect(Option.isSome(single)).toBe(true)

      if (Option.isNone(single)) {
        return
      }

      const snapshot = yield* Study.snapshot(single.value)
      const outcome = yield* Effect.either(
        Study.resume({
          space: makeSpace(),
          sampler: Sampler.random({ seed: 41 }),
          snapshot,
          direction: "minimize",
          trials: 3,
          objective: singleObjective
        })
      )

      expect(Either.isLeft(outcome)).toBe(true)

      if (Either.isRight(outcome)) {
        return
      }

      expect(outcome.left).toBeInstanceOf(InvalidStudyConfig)
      expect(outcome.left._tag).toBe("effect-search/InvalidStudyConfig")

      if (outcome.left._tag !== "effect-search/InvalidStudyConfig") {
        return
      }

      expect(outcome.left.reason).toContain("sampler kind")
    }))

  it.effect("fails resume when objective spec does not match snapshot objective spec", () =>
    Effect.gen(function*() {
      const snapshotResult = yield* Study.optimize({
        space: makeSpace(),
        sampler: Sampler.random({ seed: 818 }),
        direction: "minimize",
        trials: 5,
        objective: singleObjective
      })

      const single = asSingleObjective(snapshotResult)
      expect(Option.isSome(single)).toBe(true)

      if (Option.isNone(single)) {
        return
      }

      const snapshot = yield* Study.snapshot(single.value)
      const outcome = yield* Effect.either(
        Study.resume({
          space: makeSpace(),
          sampler: Sampler.random({ seed: 818 }),
          snapshot,
          directions: ["minimize", "minimize"],
          trials: 2,
          objective: objectiveVector
        })
      )

      expect(Either.isLeft(outcome)).toBe(true)

      if (Either.isRight(outcome)) {
        return
      }

      expect(outcome.left).toBeInstanceOf(InvalidStudyConfig)
      expect(outcome.left._tag).toBe("effect-search/InvalidStudyConfig")

      if (outcome.left._tag !== "effect-search/InvalidStudyConfig") {
        return
      }

      expect(outcome.left.reason).toContain("objective spec")
    }))

  it.effect("fails resume when stop mode does not match snapshot stop mode", () =>
    Effect.gen(function*() {
      const snapshotResult = yield* Study.optimize({
        space: makeSpace(),
        sampler: Sampler.random({ seed: 907 }),
        direction: "minimize",
        trials: 4,
        stopMode: "Drain",
        objective: singleObjective
      })

      const single = asSingleObjective(snapshotResult)
      expect(Option.isSome(single)).toBe(true)

      if (Option.isNone(single)) {
        return
      }

      const snapshot = yield* Study.snapshot(single.value)
      const outcome = yield* Effect.either(
        Study.resume({
          space: makeSpace(),
          sampler: Sampler.random({ seed: 907 }),
          snapshot,
          direction: "minimize",
          trials: 2,
          stopMode: "Interrupt",
          objective: singleObjective
        })
      )

      expect(Either.isLeft(outcome)).toBe(true)

      if (Either.isRight(outcome)) {
        return
      }

      expect(outcome.left).toBeInstanceOf(InvalidStudyConfig)
      expect(outcome.left._tag).toBe("effect-search/InvalidStudyConfig")

      if (outcome.left._tag !== "effect-search/InvalidStudyConfig") {
        return
      }

      expect(outcome.left.reason).toContain("stop mode")
    }))

  it.effect("fails resume when sampler checkpoint payload mismatches runtime contract", () =>
    Effect.gen(function*() {
      const snapshotResult = yield* Study.optimize({
        space: makeSpace(),
        sampler: Sampler.random({ seed: 52 }),
        direction: "minimize",
        trials: 4,
        objective: singleObjective
      })

      const single = asSingleObjective(snapshotResult)
      expect(Option.isSome(single)).toBe(true)

      if (Option.isNone(single)) {
        return
      }

      const snapshot = yield* Study.snapshot(single.value)
      const corruptCheckpoint = Match.value(snapshot.samplerCheckpoint).pipe(
        Match.tag("Random", ({ seed }): Sampler.SamplerCheckpoint => ({ _tag: "Random", seed: seed + 1 })),
        Match.tag("Grid", ({ seed, shuffle }): Sampler.SamplerCheckpoint => ({
          _tag: "Grid",
          seed: seed + 1,
          shuffle
        })),
        Match.tag("Tpe", ({ seed, nStartupTrials, nEiCandidates }): Sampler.SamplerCheckpoint => ({
          _tag: "Tpe",
          seed: seed + 1,
          nStartupTrials,
          nEiCandidates
        })),
        Match.tag("CmaEs", ({ seed, sigma, populationSize }): Sampler.SamplerCheckpoint => ({
          _tag: "CmaEs",
          seed: seed + 1,
          sigma,
          populationSize
        })),
        Match.tag("GpBo", ({ seed, nStartupTrials, nCandidates, acquisition }): Sampler.SamplerCheckpoint => ({
          _tag: "GpBo",
          seed: seed + 1,
          nStartupTrials,
          nCandidates,
          acquisition
        })),
        Match.exhaustive
      )
      const corruptSnapshot = new Study.StudySnapshot({
        ...snapshot,
        samplerCheckpoint: corruptCheckpoint
      })

      const outcome = yield* Effect.either(
        Study.resume({
          space: makeSpace(),
          sampler: Sampler.random({ seed: 52 }),
          snapshot: corruptSnapshot,
          direction: "minimize",
          trials: 2,
          objective: singleObjective
        })
      )

      expect(Either.isLeft(outcome)).toBe(true)

      if (Either.isRight(outcome)) {
        return
      }

      expect(outcome.left).toBeInstanceOf(InvalidStudyConfig)
      expect(outcome.left._tag).toBe("effect-search/InvalidStudyConfig")

      if (outcome.left._tag !== "effect-search/InvalidStudyConfig") {
        return
      }

      expect(outcome.left.reason).toContain("checkpoint mismatch")
    }))
})
