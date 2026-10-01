/**
 * Searches intervention configurations with MOTPE and logs non-dominated
 * combinations of modeled conflict risk, disengagement risk, and facilitator
 * load. All three objectives are minimized.
 *
 * Run: bun run examples/applications/02-social-dynamics-intervention.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Boolean as Bool, Effect, Iterable, Match, Number as Num, Option, Record, Tuple } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { type Direction, Objective, Optimization, Sampler, SearchSpace } from "@scenesystems/effect-search"

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
    cadence: SearchSpace.categorical(Tuple.make("daily", "twice-weekly", "weekly")),
    framing: SearchSpace.categorical(Tuple.make("norms", "reflective", "peer-story")),
    escalationThreshold: SearchSpace.float(0.2, 0.9),
    peerPairing: SearchSpace.boolean(),
    sessionMinutes: SearchSpace.int(15, 60, { step: 5 })
  })
  const conflictRiskScore = (config: SearchSpace.Type<typeof space>): number =>
    Num.sumAll(Arr.make(
      Num.subtract(1.1, valueOrZero(FRAMING_TRUST_GAIN, config.framing)),
      Num.multiply(Numeric.abs(Num.subtract(config.escalationThreshold, 0.58)), 1.25),
      Bool.match(config.peerPairing, { onFalse: () => 0.14, onTrue: () => Num.negate(0.17) }),
      Num.unsafeDivide(Numeric.abs(Num.subtract(config.sessionMinutes, 35)), 90)
    ))
  const disengagementRiskScore = (config: SearchSpace.Type<typeof space>): number =>
    Num.sumAll(Arr.make(
      0.3,
      valueOrZero(FRAMING_REACTANCE, config.framing),
      Num.multiply(valueOrZero(CONTACT_LOAD, config.cadence), 0.26),
      Bool.match(Num.greaterThan(config.sessionMinutes, 45), { onFalse: () => 0, onTrue: () => 0.2 }),
      Bool.match(config.peerPairing, { onFalse: () => 0.05, onTrue: () => Num.negate(0.07) })
    ))
  const facilitatorLoadScore = (config: SearchSpace.Type<typeof space>): number =>
    Num.sumAll(Arr.make(
      0.15,
      valueOrZero(CONTACT_LOAD, config.cadence),
      Num.unsafeDivide(config.sessionMinutes, 38),
      Bool.match(config.peerPairing, { onFalse: () => 0.36, onTrue: () => 0.22 }),
      Bool.match(Num.lessThan(config.escalationThreshold, 0.35), { onFalse: () => 0, onTrue: () => 0.24 })
    ))

  const result = yield* Optimization.run({
    space,
    sampler: Sampler.tpe({ seed: 2701, multivariate: true, noiseAware: true }),
    directions: Arr.replicate<Direction.Direction>("minimize", 3),
    trials: 81,
    objective: (config) => {
      const conflictRisk = conflictRiskScore(config)
      const disengagementRisk = disengagementRiskScore(config)
      const facilitatorLoad = facilitatorLoadScore(config)

      return Effect.succeed(Tuple.make(conflictRisk, disengagementRisk, facilitatorLoad))
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
              onSome: (value) => value
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
