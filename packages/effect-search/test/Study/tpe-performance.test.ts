import { describe, expect, it } from "@effect/vitest"
import { Clock, Effect, Option } from "effect"
import { abs, logStrict } from "effect-math/Numeric"

import { decodeLogLearningRateConfig, LogLearningRateSpace } from "../../src/experimental/scenarios/randomTraining.js"
import * as Sampler from "../../src/Sampler/index.js"
import * as Study from "../../src/Study/index.js"

const space = LogLearningRateSpace.make()

// Local full-suite runs contend heavily with other optimization/property tests.
// Keep this harness sensitive to real regressions without failing on scheduler noise.
const PERF_BUDGET_MS = process.env.CI ? 30_000 : 10_000

const asSingleObjective = (result: Study.StudyResult) =>
  result._tag === "SingleObjective" ? Option.some(result) : Option.none()

const objective = (raw: unknown) => {
  const config = decodeLogLearningRateConfig(raw)

  return Effect.succeed(abs(logStrict(config.lr) - logStrict(0.02)))
}

describe("deterministic TPE performance harness", () => {
  it.live(
    "completes 100-trial TPE optimization within the configured wall-clock budget",
    () =>
      Effect.gen(function*() {
        const startedAt = yield* Clock.currentTimeMillis
        const optimized = yield* Study.optimize({
          space,
          sampler: Sampler.tpe({ seed: 811, nStartupTrials: 4, nEiCandidates: 4 }),
          direction: "minimize",
          trials: 100,
          objective
        })
        const endedAt = yield* Clock.currentTimeMillis

        const resultOption = asSingleObjective(optimized)
        const elapsedMillis = endedAt - startedAt

        expect(Option.isSome(resultOption)).toBe(true)
        expect(elapsedMillis).toBeLessThan(PERF_BUDGET_MS)

        if (Option.isNone(resultOption)) {
          return
        }

        const result = resultOption.value
        expect(result.trials).toHaveLength(100)
        expect(result.trials.every((trial) => trial.state._tag === "Completed")).toBe(true)
      }),
    20_000
  )
})
