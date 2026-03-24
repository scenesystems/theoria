import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Match, Option, Order, Schema } from "effect"

import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"

const space = SearchSpace.unsafeMake({
  variant: SearchSpace.int(0, 2)
})

const decodeConfig = Schema.decodeUnknownSync(space.schema)

const point = (left: number, right: number): ReadonlyArray<number> => Arr.make(left, right)

const PROFILE_A = Arr.make(
  point(1.0, 1.0),
  point(1.003, 1.005),
  point(1.008, 1.008)
)

const PROFILE_B = Arr.make(
  point(1.004, 1.004),
  point(1.003, 1.003),
  point(1.008, 1.008)
)

const pointForVariant = (
  profile: ReadonlyArray<ReadonlyArray<number>>,
  variant: number
): ReadonlyArray<number> =>
  Arr.get(profile, variant).pipe(
    Option.getOrElse(() => point(1, 1))
  )

const objectiveFromProfile =
  (profile: ReadonlyArray<ReadonlyArray<number>>) => (raw: unknown): Effect.Effect<ReadonlyArray<number>> =>
    Effect.sync(() => pointForVariant(profile, decodeConfig(raw).variant))

const optimizeWithProfile = (
  profile: ReadonlyArray<ReadonlyArray<number>>,
  epsilon: Option.Option<number> = Option.none()
) =>
  Study.optimize({
    space,
    sampler: Sampler.grid({ shuffle: false }),
    directions: ["minimize", "minimize"],
    trials: 3,
    objective: objectiveFromProfile(profile),
    ...Option.match(epsilon, {
      onNone: () => ({}),
      onSome: (value) => ({ epsilon: value })
    })
  })

const resumeWithProfile = (
  snapshot: Study.StudySnapshot,
  profile: ReadonlyArray<ReadonlyArray<number>>,
  epsilon: Option.Option<number> = Option.none()
) =>
  Study.resume({
    space,
    sampler: Sampler.grid({ shuffle: false }),
    snapshot,
    directions: ["minimize", "minimize"],
    trials: 3,
    objective: objectiveFromProfile(profile),
    ...Option.match(epsilon, {
      onNone: () => ({}),
      onSome: (value) => ({ epsilon: value })
    })
  })

const paretoVariantSignature = (
  result: Study.StudyResult
): ReadonlyArray<number> =>
  Match.value(result).pipe(
    Match.tag("MultiObjective", ({ paretoFront }) =>
      Arr.sort(
        Arr.map(paretoFront, (trial) => decodeConfig(trial.config).variant),
        Order.number
      )),
    Match.orElse(() => Arr.empty<number>())
  )

describe("epsilon dominance", () => {
  it.effect("rejects invalid epsilon values for optimize and resume", () =>
    Effect.gen(function*() {
      const optimizeStatus = yield* optimizeWithProfile(PROFILE_A, Option.some(-0.1)).pipe(
        Effect.as("ok"),
        Effect.catchTag("effect-search/InvalidStudyConfig", () => Effect.succeed("invalid"))
      )

      expect(optimizeStatus).toBe("invalid")

      const baseline = yield* optimizeWithProfile(PROFILE_A, Option.some(0))
      const snapshot = yield* Study.snapshot(baseline)
      const resumeStatus = yield* resumeWithProfile(snapshot, PROFILE_A, Option.some(-0.1)).pipe(
        Effect.as("ok"),
        Effect.catchTag("effect-search/InvalidStudyConfig", () => Effect.succeed("invalid"))
      )

      expect(resumeStatus).toBe("invalid")
    }))

  it.effect("keeps omitted epsilon and explicit zero behavior identical", () =>
    Effect.gen(function*() {
      const implicit = yield* optimizeWithProfile(PROFILE_A)
      const explicit = yield* optimizeWithProfile(PROFILE_A, Option.some(0))

      expect(paretoVariantSignature(implicit)).toEqual(paretoVariantSignature(explicit))
    }))

  it.effect("reduces Pareto-front churn under noisy near ties", () =>
    Effect.gen(function*() {
      const noEpsilonA = yield* optimizeWithProfile(PROFILE_A)
      const noEpsilonB = yield* optimizeWithProfile(PROFILE_B)
      const epsilonA = yield* optimizeWithProfile(PROFILE_A, Option.some(0.005))
      const epsilonB = yield* optimizeWithProfile(PROFILE_B, Option.some(0.005))

      const noEpsilonSignatureA = paretoVariantSignature(noEpsilonA)
      const noEpsilonSignatureB = paretoVariantSignature(noEpsilonB)
      const epsilonSignatureA = paretoVariantSignature(epsilonA)
      const epsilonSignatureB = paretoVariantSignature(epsilonB)

      expect(noEpsilonSignatureA).not.toEqual(noEpsilonSignatureB)
      expect(epsilonSignatureA).toEqual(epsilonSignatureB)
    }))
})
