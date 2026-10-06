/**
 * Sampler context construction from current optimization state and completed trials.
 *
 * @since 0.1.0
 */
import * as History from "@scenesystems/effect-study/History"
import { Array as Arr, Effect, Match, Number as Num, Option, Schema } from "effect"

import type { SamplerConfig } from "../../../internal/configAccess.js"
import type { Objective } from "../../../Objective.js"
import { Context, Observation, Pending, PrunedObservation } from "../../../Sampler.js"
import type * as Trial from "../../../Trial.js"
import { completedTrialsFromState, maxTrialNumberFromState, pendingTrialsFromState } from "../history.js"

const toSamplerConfig = <Config>(config: Config): SamplerConfig =>
  Option.liftPredicate(config, Schema.is(Schema.Record(Schema.String, Schema.Unknown))).pipe(
    Option.getOrElse(() => ({}))
  )

const trialVariance = <Config>(trial: Trial.CompletedTrial<Config>): Option.Option<number> =>
  Option.fromNullishOr(trial.state.variance)

const toSuggestCompletedTrial = <Config>(
  trial: Trial.CompletedTrial<Config>,
  priorWeight: number
): Observation =>
  new Observation({
    trialNumber: trial.trialNumber,
    config: toSamplerConfig(trial.config),
    value: trial.state.value,
    observationWeight: Match.value(trial.prior).pipe(
      Match.when(true, () => priorWeight),
      Match.orElse(() => 1)
    ),
    ...Option.fromNullishOr(trial.cost).pipe(
      Option.match({
        onNone: () => ({}),
        onSome: (cost) => ({ cost })
      })
    ),
    ...trialVariance(trial).pipe(
      Option.match({
        onNone: () => ({}),
        onSome: (variance) => ({ variance })
      })
    )
  })

const toSuggestPendingTrial = <Config>(trial: Trial.Trial<Config>): Pending =>
  new Pending({
    trialNumber: trial.trialNumber,
    config: toSamplerConfig(trial.config)
  })

/**
 * Keeps completed objectives, pruned reports and pending reservations separate.
 *
 * @since 0.1.0
 * @category constructors
 */
export const contextForSuggestion = <Config>(
  objectiveSpec: Objective,
  state: History.History<Config, Trial.State>,
  priorWeight: number,
  epsilon: number
): Effect.Effect<Context> =>
  Effect.gen(function*() {
    const completed = completedTrialsFromState(state)
    const pending = pendingTrialsFromState(state)
    return new Context({
      completed: Arr.map(completed, (trial) => toSuggestCompletedTrial(trial, priorWeight)),
      pruned: Arr.flatMap(History.values(state), (trial) =>
        Match.value(trial.state).pipe(
          Match.tag("Pruned", ({ reports }) => [
            new PrunedObservation({
              trialNumber: trial.trialNumber,
              config: toSamplerConfig(trial.config),
              reports
            })
          ]),
          Match.orElse(() => Arr.empty<PrunedObservation>())
        )),
      pending: Arr.map(pending, toSuggestPendingTrial),
      objectiveSpec,
      nextTrialNumber: Num.increment(maxTrialNumberFromState(state)),
      epsilon
    })
  })
