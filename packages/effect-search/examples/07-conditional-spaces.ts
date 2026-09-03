/**
 * Compares linear and tree models in one study while activating only the
 * parameters that belong to the selected model family.
 *
 * Run: bun run examples/07-conditional-spaces.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Match } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Sampler, SearchSpace, Study } from "@scenesystems/effect-search"

const linearLoss = (learningRate: number, regularization: number): number =>
  Numeric.pow(Numeric.log10(learningRate) - Numeric.log10(0.02), 2) + regularization * 0.4

const treeLoss = (maxDepth: number, minSamplesLeaf: number): number =>
  Numeric.pow((maxDepth - 7) / 7, 2) + Numeric.pow((minSamplesLeaf - 2) / 4, 2) + 0.05

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
    { model: SearchSpace.categorical(["linear", "tree"]) },
    SearchSpace.switch("model", [
      SearchSpace.when("linear", linearBranch),
      SearchSpace.when("tree", treeBranch)
    ])
  )

  const result = yield* Study.minimize({
    space,
    sampler: Sampler.tpe({ seed: 17 }),
    trials: 45,
    objective: (config) =>
      Match.value(config).pipe(
        Match.when({ model: "linear" }, ({ learningRate, regularization }) =>
          Effect.succeed(linearLoss(learningRate, regularization))),
        Match.when({ model: "tree" }, ({ maxDepth, minSamplesLeaf }) =>
          Effect.succeed(treeLoss(maxDepth, minSamplesLeaf))),
        Match.exhaustive
      )
  })

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
