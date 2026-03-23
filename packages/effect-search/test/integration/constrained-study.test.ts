import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Schema } from "effect"

import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"

const space = SearchSpace.unsafeMake({
  x: SearchSpace.int(0, 9)
})

const decodeConfig = Schema.decodeUnknownSync(space.schema)

const objective = (raw: unknown): Effect.Effect<number> => Effect.sync(() => decodeConfig(raw).x)

const constraint = (raw: unknown): Effect.Effect<number> => Effect.sync(() => decodeConfig(raw).x - 4)

const asSingleObjective = (result: Study.StudyResult) =>
  result._tag === "SingleObjective" ? Option.some(result) : Option.none()

const startupTrials = 5

const samplerOptions = {
  seed: 61,
  nStartupTrials: startupTrials,
  nEiCandidates: 32
}

const trace = (result: Study.SingleObjectiveResult): ReadonlyArray<number> =>
  result.trials.map((trial) => decodeConfig(trial.config).x)

const feasibleCount = (values: ReadonlyArray<number>): number => values.filter((value) => value <= 4).length

describe("constrained study integration", () => {
  it.effect("diverges after startup and improves feasible suggestion frequency", () =>
    Effect.gen(function*() {
      const unconstrainedResult = yield* Study.optimize({
        space,
        sampler: Sampler.tpe(samplerOptions),
        direction: "maximize",
        trials: 16,
        objective
      })
      const constrainedResult = yield* Study.optimize({
        space,
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

      const unconstrainedTrace = trace(unconstrained.value)
      const constrainedTrace = trace(constrained.value)
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
