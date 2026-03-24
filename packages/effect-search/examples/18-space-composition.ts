/**
 * Space Composition — build reusable spaces with extend, pick, and omit.
 *
 * Real use case: assemble task-specific tuners from shared optimization blocks.
 *
 * What this shows: composing reusable spaces with extend and creating focused variants with pick and omit.
 *
 * Feature Type Links:
 * - {@link SearchSpace.Type}
 * - {@link Sampler.Sampler}
 * - {@link Study.StudyResult}
 *
 * Run: bun run examples/18-space-composition.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Match } from "effect"

import { Sampler, SearchSpace, Study } from "effect-search"

const program = Effect.gen(function*() {
  const optimizerSpace = yield* SearchSpace.make({
    learningRate: SearchSpace.float(1e-4, 1e-1, { scale: "log" }),
    batchSize: SearchSpace.int(16, 128, { step: 16 }),
    dropout: SearchSpace.float(0, 0.5)
  })
  const runtimeSpace = yield* SearchSpace.make({
    maxTokens: SearchSpace.int(256, 2048, { step: 256 }),
    rerankDepth: SearchSpace.int(5, 30, { step: 5 })
  })

  const fullSpace = yield* SearchSpace.extend(optimizerSpace, runtimeSpace)
  const servingSpace = yield* SearchSpace.pick(fullSpace, ["learningRate", "batchSize", "maxTokens"])
  const noDropoutSpace = yield* SearchSpace.omit(fullSpace, ["dropout"])

  const result = yield* Study.maximize({
    space: servingSpace,
    sampler: Sampler.tpe({ seed: 78 }),
    trials: 35,
    objective: (config) => {
      const learningRateScore = 1 - Math.abs(Math.log10(config.learningRate) - Math.log10(0.01))
      const batchScore = 1 - Math.abs(config.batchSize - 64) / 64
      const tokenPenalty = config.maxTokens / 4096

      return Effect.succeed(learningRateScore + batchScore - tokenPenalty)
    }
  })

  yield* Match.value(result).pipe(
    Match.tag("SingleObjective", ({ bestTrial, completionReason }) =>
      Effect.log("Space composition complete", {
        completionReason,
        fullDimensions: fullSpace.params.map((parameter) => parameter.name),
        servingDimensions: servingSpace.params.map((parameter) => parameter.name),
        noDropoutDimensions: noDropoutSpace.params.map((parameter) => parameter.name),
        bestValue: bestTrial.state.value,
        bestConfig: bestTrial.config
      })),
    Match.tag("MultiObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program)
