/**
 * Advanced Applications / 03 — Product Rollout Policy Tuning.
 *
 * Plain-English goal:
 * Grow adoption without crossing safety limits for churn risk or latency.
 *
 * Use case:
 * You are choosing rollout %, onboarding style, notification behavior,
 * ranking model, and support automation settings for a release.
 *
 * Why `effect-search`:
 * This is a mixed categorical + numeric policy problem with hard constraints.
 * `effect-search` can optimize lift while keeping explicit guardrails.
 *
 * Objective semantics:
 * - Main score (higher is better): `businessLift`.
 * - Guardrail 1: `churnRisk` must stay <= `0.24`.
 * - Guardrail 2: `p95LatencyMs` must stay <= `260`.
 *
 * What to expect in output:
 * A best configuration, plus explicit `feasible`/metrics logging so you can see
 * whether the chosen policy is truly safe to ship.
 *
 * How to use the result:
 * Use the suggested policy for canary or staged rollout planning first,
 * then validate with real production telemetry.
 *
 * Feature Type Links:
 * - {@link SearchSpace.Type}
 * - {@link Sampler.Sampler}
 * - {@link Study.StudyResult}
 *
 * Run: bun run examples/applications/03-product-rollout-policy.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Either, Match, Schema } from "effect"

import { Sampler, SearchSpace, Study } from "effect-search"

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

const churnRisk = (config: {
  readonly rolloutPercent: number
  readonly notificationCadence: "off" | "weekly" | "adaptive"
  readonly rankingModel: "baseline" | "balanced" | "aggressive"
  readonly supportAutomation: boolean
}): number =>
  0.08
  + config.rolloutPercent / 540
  + (config.notificationCadence === "adaptive" ? 0.05 : 0)
  + (config.rankingModel === "aggressive" ? 0.06 : 0)
  + (config.supportAutomation ? 0.015 : 0.04)

const p95LatencyMs = (config: {
  readonly rolloutPercent: number
  readonly notificationCadence: "off" | "weekly" | "adaptive"
  readonly rankingModel: "baseline" | "balanced" | "aggressive"
}): number =>
  170
  + (config.rankingModel === "aggressive" ? 95 : config.rankingModel === "balanced" ? 42 : 0)
  + (config.notificationCadence === "adaptive" ? 24 : 0)
  + config.rolloutPercent * 0.72

const businessLiftScore = (config: {
  readonly rolloutPercent: number
  readonly onboarding: "inline" | "guided" | "cohort"
  readonly notificationCadence: "off" | "weekly" | "adaptive"
  readonly rankingModel: "baseline" | "balanced" | "aggressive"
  readonly supportAutomation: boolean
}): number => {
  const onboardingLift = ADOPTION_LIFT[config.onboarding] ?? 0
  const cadenceLift = ADOPTION_LIFT[config.notificationCadence] ?? 0
  const rankingLift = ADOPTION_LIFT[config.rankingModel] ?? 0

  const churnViolation = Math.max(0, churnRisk(config) - 0.24)
  const latencyViolation = Math.max(0, p95LatencyMs(config) - 260) / 220

  return 0.45
    + onboardingLift
    + cadenceLift
    + rankingLift
    + (config.supportAutomation ? 0.03 : 0)
    - Math.abs(config.rolloutPercent - 65) / 420
    - churnViolation * 2.2
    - latencyViolation
}

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    rolloutPercent: SearchSpace.int(5, 100, { step: 5 }),
    onboarding: SearchSpace.categorical(["inline", "guided", "cohort"]),
    notificationCadence: SearchSpace.categorical(["off", "weekly", "adaptive"]),
    rankingModel: SearchSpace.categorical(["baseline", "balanced", "aggressive"]),
    supportAutomation: SearchSpace.boolean()
  })

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
          trialsEvaluated: trials.length,
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
