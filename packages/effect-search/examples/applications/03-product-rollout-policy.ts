/**
 * Maximizes a modeled rollout-lift score while constrained TPE rejects
 * configurations whose churn risk exceeds 0.24 or whose modeled p95 latency
 * exceeds 260 milliseconds.
 *
 * Run: bun run examples/applications/03-product-rollout-policy.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Either, Iterable, Match, Option, Record, Schema } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Sampler, SearchSpace, Study } from "@scenesystems/effect-search"

const ADOPTION_LIFT: Readonly<Record<string, number>> = {
  inline: 0.08,
  guided: 0.14,
  cohort: 0.11,
  off: 0,
  weekly: 0.05,
  adaptive: 0.09,
  baseline: 0.03,
  balanced: 0.08,
  aggressive: 0.13
}

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    rolloutPercent: SearchSpace.int(5, 100, { step: 5 }),
    onboarding: SearchSpace.categorical(["inline", "guided", "cohort"]),
    notificationCadence: SearchSpace.categorical(["off", "weekly", "adaptive"]),
    rankingModel: SearchSpace.categorical(["baseline", "balanced", "aggressive"]),
    supportAutomation: SearchSpace.boolean()
  })
  const churnRisk = (config: SearchSpace.Type<typeof space>): number =>
    0.08
    + config.rolloutPercent / 540
    + (config.notificationCadence === "adaptive" ? 0.05 : 0)
    + (config.rankingModel === "aggressive" ? 0.06 : 0)
    + (config.supportAutomation ? 0.015 : 0.04)
  const p95LatencyMs = (config: SearchSpace.Type<typeof space>): number =>
    170
    + (config.rankingModel === "aggressive" ? 95 : config.rankingModel === "balanced" ? 42 : 0)
    + (config.notificationCadence === "adaptive" ? 24 : 0)
    + config.rolloutPercent * 0.72
  const businessLiftScore = (config: SearchSpace.Type<typeof space>): number => {
    const lift = (key: string) => Option.getOrElse(Record.get(ADOPTION_LIFT, key), () => 0)
    const onboardingLift = lift(config.onboarding)
    const cadenceLift = lift(config.notificationCadence)
    const rankingLift = lift(config.rankingModel)
    const churnViolation = Numeric.max(0, churnRisk(config) - 0.24)
    const latencyViolation = Numeric.max(0, p95LatencyMs(config) - 260) / 220

    return 0.45
      + onboardingLift
      + cadenceLift
      + rankingLift
      + (config.supportAutomation ? 0.03 : 0)
      - Numeric.abs(config.rolloutPercent - 65) / 420
      - churnViolation * 2.2
      - latencyViolation
  }

  const decodeConfig = Schema.decodeUnknownEither(space.schema)

  const churnConstraint = (rawConfig: unknown) =>
    Effect.sync(() =>
      decodeConfig(rawConfig).pipe(
        Either.match({
          onLeft: () => 1,
          onRight: (config) => churnRisk(config) - 0.24
        })
      )
    )

  const latencyConstraint = (rawConfig: unknown) =>
    Effect.sync(() =>
      decodeConfig(rawConfig).pipe(
        Either.match({
          onLeft: () => 1,
          onRight: (config) => p95LatencyMs(config) - 260
        })
      )
    )

  const result = yield* Study.maximize({
    space,
    sampler: Sampler.tpe({
      seed: 2801,
      nStartupTrials: 12,
      multivariate: true,
      constraints: [churnConstraint, latencyConstraint]
    }),
    trials: 70,
    objective: (config) => Effect.succeed(businessLiftScore(config))
  })

  yield* Match.value(result).pipe(
    Match.tag(
      "SingleObjective",
      ({ bestTrial, completionReason, trials }) =>
        Effect.log("Product rollout optimization complete", {
          completionReason,
          trialsEvaluated: Iterable.size(trials),
          bestLift: bestTrial.state.value,
          bestConfig: bestTrial.config,
          churnRisk: churnRisk(bestTrial.config),
          p95LatencyMs: p95LatencyMs(bestTrial.config),
          feasible: churnRisk(bestTrial.config) <= 0.24 && p95LatencyMs(bestTrial.config) <= 260
        })
    ),
    Match.tag("MultiObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program)
