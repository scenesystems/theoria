/**
 * Sampler context construction from current study state and completed trials.
 *
 * @since 0.1.0
 */
import type * as History from "@scenesystems/effect-study/History"
import { Array as Arr, Chunk, Effect, Match, Number as Num, Option, Predicate } from "effect"

import type { SamplerConfig } from "../../../internal/configAccess.js"
import type { Objective } from "../../../Objective.js"
import { Context, Observation, Pending, type PendingPolicy } from "../../../Sampler.js"
import type * as Trial from "../../../Trial.js"
import { completedTrialsFromState, maxTrialNumberFromState, pendingTrialsFromState } from "../history.js"

const toSamplerConfig = <Config>(config: Config): SamplerConfig =>
  Option.liftPredicate(config, Predicate.isRecord).pipe(
    Option.getOrElse(() => ({}))
  )

const trialVariance = <Config>(trial: Trial.CompletedTrial<Config>): Option.Option<number> =>
  Option.fromNullable(trial.state.variance)

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
    ...Option.fromNullable(trial.cost).pipe(
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
 * Builds the sampler suggestion context from current study state, applying pending trial imputation.
 *
 * @since 0.1.0
 * @category constructors
 */
export const contextForSuggestion = <Config>(
  objectiveSpec: Objective,
  state: History.History<Config, Trial.State>,
  priorWeight: number,
  epsilon: number,
  policy: PendingPolicy
): Effect.Effect<Context> =>
  Effect.gen(function*() {
    const completed = completedTrialsFromState(state)
    const pending = pendingTrialsFromState(state)
    const baseContext = new Context({
      completed: Arr.map(completed, (trial) => toSuggestCompletedTrial(trial, priorWeight)),
      pending: Arr.map(pending, toSuggestPendingTrial),
      objectiveSpec,
      nextTrialNumber: Num.increment(maxTrialNumberFromState(state)),
      epsilon
    })

    const imputedCompleted = Arr.fromIterable(Chunk.map(
      policy.impute(baseContext),
      (observation) =>
        new Observation({
          trialNumber: observation.trialNumber,
          config: observation.config,
          value: observation.value
        })
    ))

    return new Context({
      completed: Arr.appendAll(baseContext.completed, imputedCompleted),
      pending: baseContext.pending,
      objectiveSpec: baseContext.objectiveSpec,
      nextTrialNumber: baseContext.nextTrialNumber,
      epsilon: baseContext.epsilon
    })
  })
