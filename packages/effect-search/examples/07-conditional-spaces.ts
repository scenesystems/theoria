/**
 * Compares linear and tree models in one optimization while activating only the
 * parameters that belong to the selected model family.
 *
 * Run: bun run examples/07-conditional-spaces.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Chunk, Effect, Match, Number as Num, Schema, Tuple } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Optimization, Sampler, SearchSpace } from "@scenesystems/effect-search"

const linearLoss = (learningRate: number, regularization: number): number =>
  Num.sum(
    Numeric.pow(Num.subtract(Numeric.log10(learningRate), Numeric.log10(0.02)), 2),
    Num.multiply(regularization, 0.4)
  )

const treeLoss = (maxDepth: number, minSamplesLeaf: number): number =>
  Num.sumAll(Arr.make(
    Numeric.pow(Num.divideUnsafe(Num.subtract(maxDepth, 7), 7), 2),
    Numeric.pow(Num.divideUnsafe(Num.subtract(minSamplesLeaf, 2), 4), 2),
    0.05
  ))

const program = Effect.gen(function*() {
  const linearBranch = yield* SearchSpace.make({
    learningRate: SearchSpace.float(1e-4, 1e-1, { scale: "log" }),
    regularization: SearchSpace.float(0, 1)
  })

  const treeBranch = yield* SearchSpace.make({
    maxDepth: SearchSpace.int(2, 12),
    minSamplesLeaf: SearchSpace.int(1, 6)
  })

  const space = yield* SearchSpace.makeConditional(
    { model: SearchSpace.categorical(Tuple.make("linear", "tree")) },
    SearchSpace.switchOn(
      "model",
      Chunk.make(
        SearchSpace.when("linear", linearBranch),
        SearchSpace.when("tree", treeBranch)
      )
    )
  )
  const ConditionalConfig = Schema.Union([
    Schema.Struct({
      model: Schema.Literal("linear"),
      learningRate: Schema.Finite,
      regularization: Schema.Finite
    }),
    Schema.Struct({
      model: Schema.Literal("tree"),
      maxDepth: Schema.Finite,
      minSamplesLeaf: Schema.Finite
    })
  ])

  const result = yield* Optimization.minimize(
    new Optimization.FlatOptions({
      space,
      sampler: Sampler.tpe(new Sampler.TpeOptions({ seed: 17 })),
      trials: 45,
      objective: (rawConfig) =>
        Effect.gen(function*() {
          const config = yield* Schema.decodeUnknownEffect(ConditionalConfig)(rawConfig)

          return Match.value(config).pipe(
            Match.when(
              { model: "linear" },
              ({ learningRate, regularization }) => linearLoss(learningRate, regularization)
            ),
            Match.when(
              { model: "tree" },
              ({ maxDepth, minSamplesLeaf }) => treeLoss(maxDepth, minSamplesLeaf)
            ),
            Match.exhaustive
          )
        })
    })
  )

  yield* Match.value(result).pipe(
    Match.tag("SingleObjective", ({ bestTrial, completionReason }) =>
      Effect.log("Best conditional model", {
        bestLoss: bestTrial.state.value,
        bestConfig: bestTrial.config,
        completionReason
      })),
    Match.tag("MultiObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program)
