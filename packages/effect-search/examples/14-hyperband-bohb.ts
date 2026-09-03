/**
 * Runs HyperBand and BOHB against the same fidelity-aware objective and logs
 * each scheduler's best completed trial.
 *
 * Run: bun run examples/14-hyperband-bohb.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Match, Option } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Sampler, Scheduler, SearchSpace, Study } from "@scenesystems/effect-search"

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    learningRate: SearchSpace.float(1e-4, 1e-1, { scale: "log" }),
    momentum: SearchSpace.float(0.5, 0.99),
    budget: SearchSpace.fidelity(1, 9)
  })

  const objective = (
    config: SearchSpace.Type<typeof space>,
    runtime: Study.ObjectiveTrialRuntime
  ) =>
    Effect.gen(function*() {
      const resource = yield* runtime.resource.pipe(Effect.map(Option.getOrElse(() => config.budget)))
      const learningRateLoss = Numeric.pow(Numeric.log10(config.learningRate) - Numeric.log10(0.01), 2)
      const momentumLoss = Numeric.pow(config.momentum - 0.9, 2)

      return learningRateLoss + momentumLoss + 1 / resource
    })

  const hyperbandScheduler = yield* Scheduler.hyperband({
    maxResource: 9,
    reductionFactor: 3,
    sampler: Sampler.random({ seed: 320 })
  })
  const bohbScheduler = yield* Scheduler.bohb({
    maxResource: 9,
    reductionFactor: 3,
    seed: 320,
    tpeOptions: {
      seed: 320,
      nStartupTrials: 4,
      nEiCandidates: 24
    }
  })

  const hyperbandResult = yield* Study.minimize({
    space,
    scheduler: hyperbandScheduler,
    objective
  })
  const bohbResult = yield* Study.minimize({
    space,
    scheduler: bohbScheduler,
    objective
  })

  const logResult = (label: string, result: Study.StudyResult<SearchSpace.Type<typeof space>>) =>
    Match.value(result).pipe(
      Match.tag(
        "SingleObjective",
        ({ bestTrial, completionReason, trials, schedulerSummary }) =>
          Effect.log("Scheduler study complete", {
            scheduler: label,
            completionReason,
            trialsEvaluated: trials.length,
            bestValue: bestTrial.state.value,
            bestConfig: bestTrial.config,
            bracketCount: schedulerSummary?.brackets.length ?? 0
          })
      ),
      Match.tag("MultiObjective", () => Effect.void),
      Match.exhaustive
    )

  yield* logResult("hyperband", hyperbandResult)
  yield* logResult("bohb", bohbResult)
})

BunRuntime.runMain(program)
