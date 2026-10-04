import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Match, Number as Num, Option, Schema, Struct } from "effect"

import * as Optimization from "../../src/Optimization.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"

const space = SearchSpace.make({
  x: SearchSpace.int(0, 9)
})

const decodeConfig = (raw: unknown) =>
  Effect.flatMap(space, (resolved) => Schema.decodeUnknownEffect(resolved.schema)(raw))

const objective = (raw: unknown) => decodeConfig(raw).pipe(Effect.map((config) => config.x))

const asSingleObjective = (result: Optimization.Result): Option.Option<Optimization.SingleObjectiveResult> =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", (single) => Option.some(single)),
    Match.orElse(() => Option.none())
  )

const startupTrials = 5

const samplerOptions = new Sampler.TpeOptions({
  seed: 61,
  nStartupTrials: startupTrials,
  nEiCandidates: 32
})

const trace = (result: Optimization.SingleObjectiveResult) =>
  Effect.forEach(result.trials, (trial) => decodeConfig(trial.config).pipe(Effect.map((config) => config.x)))

const feasibleCount = (values: Iterable<number>): number => Arr.length(Arr.filter(values, Num.isLessThanOrEqualTo(4)))

describe("constrained optimization integration", () => {
  it.effect("diverges after startup and improves feasible suggestion frequency", () =>
    Effect.gen(function*() {
      const resolvedSpace = yield* space
      const decodeConstraintConfig = Schema.decodeUnknownOption(resolvedSpace.schema)
      const constraint = (raw: unknown) =>
        Effect.succeed(
          Option.match(decodeConstraintConfig(raw), {
            onNone: () => Number.POSITIVE_INFINITY,
            onSome: (config) => Num.subtract(config.x, 4)
          })
        )
      const unconstrainedResult = yield* Optimization.run(
        new Optimization.FlatOptions({
          space: resolvedSpace,
          sampler: Sampler.tpe(samplerOptions),
          direction: "maximize",
          trials: 16,
          objective
        })
      )
      const constrainedResult = yield* Optimization.run(
        new Optimization.FlatOptions({
          space: resolvedSpace,
          sampler: Sampler.tpe(
            new Sampler.TpeOptions(Struct.assign(samplerOptions, {
              constraints: Arr.of(constraint)
            }))
          ),
          direction: "maximize",
          trials: 16,
          objective
        })
      )
      const unconstrained = asSingleObjective(unconstrainedResult)
      const constrained = asSingleObjective(constrainedResult)

      expect(Option.isSome(unconstrained)).toBe(true)
      expect(Option.isSome(constrained)).toBe(true)

      const unconstrainedRun = yield* Effect.fromOption(unconstrained)
      const constrainedRun = yield* Effect.fromOption(constrained)

      const unconstrainedTrace = yield* trace(unconstrainedRun)
      const constrainedTrace = yield* trace(constrainedRun)
      const unconstrainedPostStartup = Arr.drop(unconstrainedTrace, startupTrials)
      const constrainedPostStartup = Arr.drop(constrainedTrace, startupTrials)

      expect(Arr.take(constrainedTrace, startupTrials)).toEqual(
        Arr.take(unconstrainedTrace, startupTrials)
      )
      expect(constrainedPostStartup).not.toEqual(unconstrainedPostStartup)
      expect(feasibleCount(constrainedPostStartup)).toBeGreaterThan(
        feasibleCount(unconstrainedPostStartup)
      )
    }), 15_000)
})
