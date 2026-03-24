/**
 * Advanced Applications / 02 — Social Intervention Policy Tuning.
 *
 * Plain-English goal:
 * Find intervention settings that reduce conflict and dropout without overloading facilitators.
 *
 * Use case:
 * You control practical policy knobs (cadence, message framing, escalation threshold,
 * peer pairing, session length) and need a shortlist of balanced policies.
 *
 * Why `effect-search`:
 * This is a noisy policy problem with competing goals. A multi-objective study
 * keeps trade-offs visible instead of hiding them behind one combined score.
 *
 * Objective semantics:
 * 1. `conflictRisk` (lower is better): modeled escalation risk.
 * 2. `disengagementRisk` (lower is better): modeled dropout risk.
 * 3. `facilitatorLoad` (lower is better): delivery burden on facilitators.
 *
 * What to expect in output:
 * A handful of Pareto policies. Each policy is a different balance between
 * participant outcomes and operational effort.
 *
 * How to use the result:
 * Pick candidates based on your program priorities (participant protection,
 * staffing capacity, desired intervention intensity), then pilot them.
 *
 * Feature Type Links:
 * - {@link SearchSpace.Type}
 * - {@link Contracts.ObjectiveVector}
 * - {@link Study.StudyResult}
 *
 * Run: bun run examples/applications/02-social-dynamics-intervention.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Match } from "effect"

import { Contracts, Sampler, SearchSpace, Study } from "effect-search"

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

const conflictRiskScore = (config: {
  readonly framing: "norms" | "reflective" | "peer-story"
  readonly escalationThreshold: number
  readonly peerPairing: boolean
  readonly sessionMinutes: number
}): number =>
  1.1
  - (FRAMING_TRUST_GAIN[config.framing] ?? 0)
  + Math.abs(config.escalationThreshold - 0.58) * 1.25
  + (config.peerPairing ? -0.17 : 0.14)
  + Math.abs(config.sessionMinutes - 35) / 90

const disengagementRiskScore = (config: {
  readonly cadence: "daily" | "twice-weekly" | "weekly"
  readonly framing: "norms" | "reflective" | "peer-story"
  readonly peerPairing: boolean
  readonly sessionMinutes: number
}): number =>
  0.3
  + (FRAMING_REACTANCE[config.framing] ?? 0)
  + (CONTACT_LOAD[config.cadence] ?? 0) * 0.26
  + (config.sessionMinutes > 45 ? 0.2 : 0)
  + (config.peerPairing ? -0.07 : 0.05)

const facilitatorLoadScore = (config: {
  readonly cadence: "daily" | "twice-weekly" | "weekly"
  readonly escalationThreshold: number
  readonly peerPairing: boolean
  readonly sessionMinutes: number
}): number =>
  0.15
  + (CONTACT_LOAD[config.cadence] ?? 0)
  + config.sessionMinutes / 38
  + (config.peerPairing ? 0.22 : 0.36)
  + (config.escalationThreshold < 0.35 ? 0.24 : 0)

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    cadence: SearchSpace.categorical(["daily", "twice-weekly", "weekly"]),
    framing: SearchSpace.categorical(["norms", "reflective", "peer-story"]),
    escalationThreshold: SearchSpace.float(0.2, 0.9),
    peerPairing: SearchSpace.boolean(),
    sessionMinutes: SearchSpace.int(15, 60, { step: 5 })
  })

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
          trialsEvaluated: trials.length,
          paretoFrontSize: paretoFront.length
        })

        yield* Effect.forEach(paretoFront.slice(0, 6), (trial) => {
          const values = Contracts.normalizeObjectiveVector(trial.state.value)

          return Effect.log("Pareto intervention", {
            conflictRisk: values[0]?.toFixed(3),
            disengagementRisk: values[1]?.toFixed(3),
            facilitatorLoad: values[2]?.toFixed(3),
            policy: trial.config
          })
        }, { discard: true })
      })),
    Match.tag("SingleObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program)
