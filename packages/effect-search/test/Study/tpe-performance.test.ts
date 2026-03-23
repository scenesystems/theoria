import { describe, expect, it } from "@effect/vitest"
import { Clock, Effect, Option } from "effect"

import {
  decodeLogLearningRateConfig,
  makeLogLearningRateSpace
} from "../../src/experimental/scenarios/randomTraining.js"
import * as Float64 from "../../src/internal/float64.js"
import * as Sampler from "../../src/Sampler/index.js"
import * as Study from "../../src/Study/index.js"

const space = makeLogLearningRateSpace()

const asSingleObjective = (result: Study.StudyResult) =>
  result._tag === "SingleObjective" ? Option.some(result) : Option.none()

const objective = (raw: unknown) => {
  const config = decodeLogLearningRateConfig(raw)

  return Effect.succeed(Float64.abs(Float64.log(config.lr) - Float64.log(0.02)))
}

describe("deterministic TPE performance harness", () => {
  it.live(
    "completes 100-trial TPE optimization under 6 seconds with local objective math only",
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
        expect(elapsedMillis).toBeLessThan(6_000)

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
