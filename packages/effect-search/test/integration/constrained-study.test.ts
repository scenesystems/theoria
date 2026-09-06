import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Schema } from "effect"

import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"

const space = SearchSpace.make({
  x: SearchSpace.int(0, 9)
})

const decodeConfig = (raw: unknown) => Effect.flatMap(space, (resolved) => Schema.decodeUnknown(resolved.schema)(raw))

const objective = (raw: unknown) => decodeConfig(raw).pipe(Effect.map((config) => config.x))

const asSingleObjective = (result: Study.StudyResult) =>
  result._tag === "SingleObjective" ? Option.some(result) : Option.none()

const startupTrials = 5

const samplerOptions = {
  seed: 61,
  nStartupTrials: startupTrials,
  nEiCandidates: 32
}

const trace = (result: Study.SingleObjectiveResult) =>
  Effect.forEach(result.trials, (trial) => decodeConfig(trial.config).pipe(Effect.map((config) => config.x)))

const feasibleCount = (values: ReadonlyArray<number>): number => values.filter((value) => value <= 4).length

describe("constrained study integration", () => {
  it.effect("diverges after startup and improves feasible suggestion frequency", () =>
    Effect.gen(function*() {
      const resolvedSpace = yield* space
      const decodeConstraintConfig = Schema.decodeUnknownOption(resolvedSpace.schema)
      const constraint = (raw: unknown) =>
        Effect.succeed(
          Option.match(decodeConstraintConfig(raw), {
            onNone: () => Number.POSITIVE_INFINITY,
            onSome: (config) => config.x - 4
          })
        )
      const unconstrainedResult = yield* Study.optimize({
        space: resolvedSpace,
        sampler: Sampler.tpe(samplerOptions),
        direction: "maximize",
        trials: 16,
        objective
      })
      const constrainedResult = yield* Study.optimize({
        space: resolvedSpace,
        sampler: Sampler.tpe({
          ...samplerOptions,
          constraints: [constraint]
        }),
        direction: "maximize",
        trials: 16,
        objective
      })
      const unconstrained = asSingleObjective(unconstrainedResult)
      const constrained = asSingleObjective(constrainedResult)

      expect(Option.isSome(unconstrained)).toBe(true)
      expect(Option.isSome(constrained)).toBe(true)

      if (Option.isNone(unconstrained) || Option.isNone(constrained)) {
        return
      }

      const unconstrainedTrace = yield* trace(unconstrained.value)
      const constrainedTrace = yield* trace(constrained.value)
      const unconstrainedPostStartup = unconstrainedTrace.slice(startupTrials)
      const constrainedPostStartup = constrainedTrace.slice(startupTrials)

      expect(constrainedTrace.slice(0, startupTrials)).toEqual(
        unconstrainedTrace.slice(0, startupTrials)
      )
      expect(constrainedPostStartup).not.toEqual(unconstrainedPostStartup)
      expect(feasibleCount(constrainedPostStartup)).toBeGreaterThan(
        feasibleCount(unconstrainedPostStartup)
      )
    }), 15_000)
})
