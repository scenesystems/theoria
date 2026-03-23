/**
 * HyperBand + BOHB — compare random and Bayesian multi-fidelity scheduling.
 *
 * Real use case: tune expensive training loops with fidelity-aware promotion.
 *
 * What this shows: multi-fidelity scheduling and how HyperBand random sampling differs from BOHB TPE guidance.
 *
 * Feature Type Links:
 * - {@link SearchSpace.Type}
 * - {@link Sampler.Sampler}
 * - {@link Study.StudyResult}
 *
 * Run: bun run examples/14-hyperband-bohb.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Match, Option } from "effect"

import { Sampler, Scheduler, SearchSpace, Study } from "effect-search"

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
      const learningRateLoss = (Math.log10(config.learningRate) - Math.log10(0.01)) ** 2
      const momentumLoss = (config.momentum - 0.9) ** 2

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
