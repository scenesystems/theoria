/**
 * Rate-Limited Objective — keep external API calls within provider quotas.
 *
 * Real use case: optimize prompts while respecting strict request throughput limits.
 *
 * What this shows: wrapping objective execution with rate limiting to stay within provider quotas.
 *
 * Feature Type Links:
 * - {@link SearchSpace.Type}
 * - {@link Sampler.Sampler}
 * - {@link Study.StudyResult}
 *
 * Run: bun run examples/24-rate-limiter.ts
 */
import * as RateLimiter from "@effect/experimental/RateLimiter"
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Match, Number as Num, Ref } from "effect"

import { Sampler, SearchSpace, Study } from "effect-search"

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    temperature: SearchSpace.float(0, 1.2),
    maxTokens: SearchSpace.int(128, 2048, { step: 128 })
  })
  const inFlightRef = yield* Ref.make(0)
  const maxInFlightRef = yield* Ref.make(0)

  const evaluatePrompt = (config: SearchSpace.Type<typeof space>) =>
    Effect.acquireUseRelease(
      Ref.updateAndGet(inFlightRef, Num.increment).pipe(
        Effect.tap((inFlight) => Ref.update(maxInFlightRef, (current) => Num.max(current, inFlight)))
      ),
      () =>
        Effect.sleep("40 millis").pipe(
          Effect.map(() => {
            const quality = 1 - Math.abs(config.temperature - 0.65)
            const tokenPenalty = config.maxTokens / 4096

            return quality - tokenPenalty
          })
        ),
      () => Ref.update(inFlightRef, Num.decrement)
    )

  const withLimiter = yield* RateLimiter.makeWithRateLimiter
  const limitedObjective = (config: SearchSpace.Type<typeof space>) =>
    evaluatePrompt(config).pipe(
      withLimiter({
        key: "example-objective",
        limit: 2,
        window: "100 millis",
        onExceeded: "delay",
        algorithm: "fixed-window"
      })
    )

  const result = yield* Study.maximize({
    space,
    sampler: Sampler.tpe({ seed: 24 }),
    trials: 18,
    concurrency: 6,
    objective: limitedObjective
  })
  const maxInFlight = yield* Ref.get(maxInFlightRef)

  yield* Match.value(result).pipe(
    Match.tag(
      "SingleObjective",
      ({ bestTrial, completionReason, trials }) =>
        Effect.log("Rate-limited optimization complete", {
          completionReason,
          trialsEvaluated: trials.length,
          maxInFlight,
          bestValue: bestTrial.state.value,
          bestConfig: bestTrial.config
        })
    ),
    Match.tag("MultiObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(
  program.pipe(
    Effect.provide(RateLimiter.layer),
    Effect.provide(RateLimiter.layerStoreMemory)
  )
)
