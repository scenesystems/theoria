import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Match, Number as Num, Option, Order, Schema } from "effect"

import type { Direction } from "../../src/Direction.js"
import * as Optimization from "../../src/Optimization.js"
import type * as OptimizationSnapshot from "../../src/OptimizationSnapshot.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"

const space = SearchSpace.make({
  variant: SearchSpace.int(0, 2)
})

const decodeConfig = Schema.decodeUnknownSync(Schema.Struct({ variant: Schema.Number }))

const point = (left: number, right: number) => Arr.make(left, right)

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
  profile: typeof PROFILE_A,
  variant: number
) =>
  Arr.get(profile, variant).pipe(
    Option.getOrElse(() => point(1, 1))
  )

const objectiveFromProfile = (profile: typeof PROFILE_A) => (config: { readonly variant: number }) =>
  Effect.succeed(pointForVariant(profile, config.variant))

const runWithProfile = (
  profile: typeof PROFILE_A,
  epsilon: Option.Option<number> = Option.none()
) =>
  Effect.flatMap(space, (searchSpace) =>
    Optimization.run({
      space: searchSpace,
      sampler: Sampler.grid({ shuffle: false }),
      directions: Arr.make<Arr.NonEmptyArray<Direction>>("minimize", "minimize"),
      trials: 3,
      objective: objectiveFromProfile(profile),
      ...Option.match(epsilon, {
        onNone: () => ({}),
        onSome: (value) => ({ epsilon: value })
      })
    }))

const resumeWithProfile = (
  snapshot: OptimizationSnapshot.OptimizationSnapshot,
  profile: typeof PROFILE_A,
  epsilon: Option.Option<number> = Option.none()
) =>
  Effect.flatMap(space, (searchSpace) =>
    Optimization.resume({
      space: searchSpace,
      sampler: Sampler.grid({ shuffle: false }),
      snapshot,
      directions: Arr.make<Arr.NonEmptyArray<Direction>>("minimize", "minimize"),
      trials: 3,
      objective: objectiveFromProfile(profile),
      ...Option.match(epsilon, {
        onNone: () => ({}),
        onSome: (value) => ({ epsilon: value })
      })
    }))

const paretoVariantSignature = (result: Optimization.Result) =>
  Match.value(result).pipe(
    Match.tag("MultiObjective", ({ paretoFront }) =>
      Arr.sort(
        Arr.map(Arr.fromIterable(paretoFront), (trial) => decodeConfig(trial.config).variant),
        Order.number
      )),
    Match.orElse(() => Arr.empty<number>())
  )

describe("epsilon dominance", () => {
  it.effect("rejects invalid epsilon values for run and resume", () =>
    Effect.gen(function*() {
      const runStatus = yield* runWithProfile(PROFILE_A, Option.some(Num.negate(0.1))).pipe(
        Effect.as("ok"),
        Effect.catchTag("effect-search/InvalidOptimizationConfig", () => Effect.succeed("invalid"))
      )

      expect(runStatus).toBe("invalid")

      const baseline = yield* runWithProfile(PROFILE_A, Option.some(0))
      const snapshot = yield* Optimization.snapshot(baseline)
      const resumeStatus = yield* resumeWithProfile(snapshot, PROFILE_A, Option.some(Num.negate(0.1))).pipe(
        Effect.as("ok"),
        Effect.catchTag("effect-search/InvalidOptimizationConfig", () => Effect.succeed("invalid"))
      )

      expect(resumeStatus).toBe("invalid")
    }))

  it.effect("keeps omitted epsilon and explicit zero behavior identical", () =>
    Effect.gen(function*() {
      const implicit = yield* runWithProfile(PROFILE_A)
      const explicit = yield* runWithProfile(PROFILE_A, Option.some(0))

      expect(paretoVariantSignature(implicit)).toEqual(paretoVariantSignature(explicit))
    }))

  it.effect("reduces Pareto-front churn under noisy near ties", () =>
    Effect.gen(function*() {
      const noEpsilonA = yield* runWithProfile(PROFILE_A)
      const noEpsilonB = yield* runWithProfile(PROFILE_B)
      const epsilonA = yield* runWithProfile(PROFILE_A, Option.some(0.005))
      const epsilonB = yield* runWithProfile(PROFILE_B, Option.some(0.005))

      const noEpsilonSignatureA = paretoVariantSignature(noEpsilonA)
      const noEpsilonSignatureB = paretoVariantSignature(noEpsilonB)
      const epsilonSignatureA = paretoVariantSignature(epsilonA)
      const epsilonSignatureB = paretoVariantSignature(epsilonB)

      expect(noEpsilonSignatureA).not.toEqual(noEpsilonSignatureB)
      expect(epsilonSignatureA).toEqual(epsilonSignatureB)
    }))
})
