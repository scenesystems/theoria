/**
 * Maximizes a modeled rollout-lift score while constrained TPE rejects
 * configurations whose churn risk exceeds 0.24 or whose modeled p95 latency
 * exceeds 260 milliseconds.
 *
 * Run: bun run examples/applications/03-product-rollout-policy.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import {
  Array as Arr,
  Boolean as Bool,
  Effect,
  Either,
  Iterable,
  Match,
  Number as Num,
  Option,
  Record,
  Schema,
  Tuple
} from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Optimization, Sampler, SearchSpace } from "@scenesystems/effect-search"

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
    onboarding: SearchSpace.categorical(Tuple.make("inline", "guided", "cohort")),
    notificationCadence: SearchSpace.categorical(Tuple.make("off", "weekly", "adaptive")),
    rankingModel: SearchSpace.categorical(Tuple.make("baseline", "balanced", "aggressive")),
    supportAutomation: SearchSpace.boolean()
  })
  const churnRisk = (config: SearchSpace.Type<typeof space>): number =>
    Num.sumAll(Arr.make(
      0.08,
      Num.unsafeDivide(config.rolloutPercent, 540),
      Match.value(config.notificationCadence).pipe(
        Match.when("adaptive", () => 0.05),
        Match.orElse(() => 0)
      ),
      Match.value(config.rankingModel).pipe(
        Match.when("aggressive", () => 0.06),
        Match.orElse(() => 0)
      ),
      Bool.match(config.supportAutomation, { onFalse: () => 0.04, onTrue: () => 0.015 })
    ))
  const p95LatencyMs = (config: SearchSpace.Type<typeof space>): number =>
    Num.sumAll(Arr.make(
      170,
      Match.value(config.rankingModel).pipe(
        Match.when("aggressive", () => 95),
        Match.when("balanced", () => 42),
        Match.orElse(() => 0)
      ),
      Match.value(config.notificationCadence).pipe(
        Match.when("adaptive", () => 24),
        Match.orElse(() => 0)
      ),
      Num.multiply(config.rolloutPercent, 0.72)
    ))
  const businessLiftScore = (config: SearchSpace.Type<typeof space>): number => {
    const lift = (key: string) => Option.getOrElse(Record.get(ADOPTION_LIFT, key), () => 0)
    const onboardingLift = lift(config.onboarding)
    const cadenceLift = lift(config.notificationCadence)
    const rankingLift = lift(config.rankingModel)
    const churnViolation = Numeric.max(0, Num.subtract(churnRisk(config), 0.24))
    const latencyViolation = Num.unsafeDivide(Numeric.max(0, Num.subtract(p95LatencyMs(config), 260)), 220)

    return Num.sumAll(Arr.make(
      0.45,
      onboardingLift,
      cadenceLift,
      rankingLift,
      Bool.match(config.supportAutomation, { onFalse: () => 0, onTrue: () => 0.03 }),
      Num.negate(Num.unsafeDivide(Numeric.abs(Num.subtract(config.rolloutPercent, 65)), 420)),
      Num.negate(Num.multiply(churnViolation, 2.2)),
      Num.negate(latencyViolation)
    ))
  }

  const decodeConfig = Schema.decodeUnknownEither(space.schema)

  const churnConstraint = (rawConfig: unknown) =>
    Effect.sync(() =>
      decodeConfig(rawConfig).pipe(
        Either.match({
          onLeft: () => 1,
          onRight: (config) => Num.subtract(churnRisk(config), 0.24)
        })
      )
    )

  const latencyConstraint = (rawConfig: unknown) =>
    Effect.sync(() =>
      decodeConfig(rawConfig).pipe(
        Either.match({
          onLeft: () => 1,
          onRight: (config) => Num.subtract(p95LatencyMs(config), 260)
        })
      )
    )

  const result = yield* Optimization.maximize({
    space,
    sampler: Sampler.tpe({
      seed: 2801,
      nStartupTrials: 12,
      multivariate: true,
      constraints: Arr.make(churnConstraint, latencyConstraint)
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
          feasible: Bool.and(
            Num.lessThanOrEqualTo(churnRisk(bestTrial.config), 0.24),
            Num.lessThanOrEqualTo(p95LatencyMs(bestTrial.config), 260)
          )
        })
    ),
    Match.tag("MultiObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program)
