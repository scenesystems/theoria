/**
 * Conditional Spaces — tune branch-specific knobs in one study.
 *
 * Real use case: compare linear and tree models with different parameter sets.
 *
 * What this shows: tree-structured search where different model families activate different parameter branches.
 *
 * Feature Type Links:
 * - {@link SearchSpace.Type}
 * - {@link Sampler.Sampler}
 * - {@link Study.StudyResult}
 *
 * Run: bun run examples/07-conditional-spaces.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Match } from "effect"

import { Sampler, SearchSpace, Study } from "effect-search"

const linearLoss = (learningRate: number, regularization: number): number =>
  (Math.log10(learningRate) - Math.log10(0.02)) ** 2 + regularization * 0.4

const treeLoss = (maxDepth: number, minSamplesLeaf: number): number =>
  ((maxDepth - 7) / 7) ** 2 + ((minSamplesLeaf - 2) / 4) ** 2 + 0.05

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
