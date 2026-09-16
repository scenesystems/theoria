/**
 * Searches intervention configurations with MOTPE and logs non-dominated
 * combinations of modeled conflict risk, disengagement risk, and facilitator
 * load. All three objectives are minimized.
 *
 * Run: bun run examples/applications/02-social-dynamics-intervention.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Effect, Iterable, Match, Option, Record } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Objective, Sampler, SearchSpace, Study } from "@scenesystems/effect-search"

const CONTACT_LOAD: Readonly<Record<string, number>> = {
  daily: 1.0,
  "twice-weekly": 0.65,
  weekly: 0.35
}

const FRAMING_TRUST_GAIN: Readonly<Record<string, number>> = {
  norms: 0.25,
  reflective: 0.42,
  "peer-story": 0.38
}

const FRAMING_REACTANCE: Readonly<Record<string, number>> = {
  norms: 0.22,
  reflective: 0.11,
  "peer-story": 0.15
}

const valueOrZero = (values: Readonly<Record<string, number>>, key: string): number =>
  Option.getOrElse(Record.get(values, key), () => 0)

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    cadence: SearchSpace.categorical(["daily", "twice-weekly", "weekly"]),
    framing: SearchSpace.categorical(["norms", "reflective", "peer-story"]),
    escalationThreshold: SearchSpace.float(0.2, 0.9),
    peerPairing: SearchSpace.boolean(),
    sessionMinutes: SearchSpace.int(15, 60, { step: 5 })
  })
  const conflictRiskScore = (config: SearchSpace.Type<typeof space>): number =>
    1.1
    - valueOrZero(FRAMING_TRUST_GAIN, config.framing)
    + Numeric.abs(config.escalationThreshold - 0.58) * 1.25
    + (config.peerPairing ? -0.17 : 0.14)
    + Numeric.abs(config.sessionMinutes - 35) / 90
  const disengagementRiskScore = (config: SearchSpace.Type<typeof space>): number =>
    0.3
    + valueOrZero(FRAMING_REACTANCE, config.framing)
    + valueOrZero(CONTACT_LOAD, config.cadence) * 0.26
    + (config.sessionMinutes > 45 ? 0.2 : 0)
    + (config.peerPairing ? -0.07 : 0.05)
  const facilitatorLoadScore = (config: SearchSpace.Type<typeof space>): number =>
    0.15
    + valueOrZero(CONTACT_LOAD, config.cadence)
    + config.sessionMinutes / 38
    + (config.peerPairing ? 0.22 : 0.36)
    + (config.escalationThreshold < 0.35 ? 0.24 : 0)

  const result = yield* Study.optimize({
    space,
    sampler: Sampler.tpe({ seed: 2701, multivariate: true, noiseAware: true }),
    directions: ["minimize", "minimize", "minimize"],
    trials: 81,
    objective: (config) => {
      const conflictRisk = conflictRiskScore(config)
      const disengagementRisk = disengagementRiskScore(config)
      const facilitatorLoad = facilitatorLoadScore(config)

      return Effect.succeed([conflictRisk, disengagementRisk, facilitatorLoad])
    }
  })

  yield* Match.value(result).pipe(
    Match.tag("MultiObjective", ({ paretoFront, completionReason, trials }) =>
      Effect.gen(function*() {
        yield* Effect.log("Social intervention optimization complete", {
          completionReason,
          trialsEvaluated: Iterable.size(trials),
          paretoFrontSize: Iterable.size(paretoFront)
        })

        yield* Effect.forEach(Arr.take(paretoFront, 6), (trial) => {
          const values = Objective.toVector(trial.state.value)
          const formatValue = (index: number) =>
            Option.match(Arr.get(values, index), {
              onNone: () => "unavailable",
              onSome: (value) => value.toFixed(3)
            })

          return Effect.log("Pareto intervention", {
            conflictRisk: formatValue(0),
            disengagementRisk: formatValue(1),
            facilitatorLoad: formatValue(2),
            policy: trial.config
          })
        }, { discard: true })
      })),
    Match.tag("SingleObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program)
