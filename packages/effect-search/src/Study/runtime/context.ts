/**
 * Sampler context construction from current study state and completed trials.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Number as Num, Option, Predicate } from "effect"

import { type ObjectiveSpec } from "../../contracts/ObjectiveSpec.js"
import type { SamplerConfig } from "../../internal/configAccess.js"
import {
  PendingImputationPolicySpi,
  SuggestCompletedTrial,
  SuggestContext,
  SuggestPendingTrial
} from "../../Sampler/index.js"
import type * as Trial from "../../Trial/index.js"
import { completedTrialsFromState, maxTrialNumberFromState, pendingTrialsFromState, type StudyState } from "../state.js"

const toSamplerConfig = <Config>(config: Config): SamplerConfig => Predicate.isRecord(config) ? config : {}

const trialVariance = <Config>(trial: Trial.CompletedTrial<Config>): Option.Option<number> =>
  Option.fromNullable(trial.state.variance)

const toSuggestCompletedTrial = <Config>(
  trial: Trial.CompletedTrial<Config>,
  priorWeight: number
): SuggestCompletedTrial =>
  new SuggestCompletedTrial({
    trialNumber: trial.trialNumber,
    config: toSamplerConfig(trial.config),
    value: trial.state.value,
    observationWeight: trial.prior === true ? priorWeight : 1,
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

const toSuggestPendingTrial = <Config>(trial: Trial.Trial<Config>): SuggestPendingTrial =>
  new SuggestPendingTrial({
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
  objectiveSpec: ObjectiveSpec,
  state: StudyState<Config>,
  priorWeight: number,
  epsilon: number
): Effect.Effect<SuggestContext, never, PendingImputationPolicySpi> =>
  Effect.gen(function*() {
    const completed = completedTrialsFromState(state)
    const pending = pendingTrialsFromState(state)
    const policy = yield* PendingImputationPolicySpi
    const baseContext = new SuggestContext({
      completed: Arr.map(completed, (trial) => toSuggestCompletedTrial(trial, priorWeight)),
      pending: Arr.map(pending, toSuggestPendingTrial),
      objectiveSpec,
      nextTrialNumber: Num.increment(maxTrialNumberFromState(state)),
      epsilon
    })

    const imputedCompleted = Arr.map(
      policy.impute(baseContext),
      (observation) =>
        new SuggestCompletedTrial({
          trialNumber: observation.trialNumber,
          config: observation.config,
          value: observation.value
        })
    )

    return new SuggestContext({
      completed: Arr.appendAll(baseContext.completed, imputedCompleted),
      pending: baseContext.pending,
      objectiveSpec: baseContext.objectiveSpec,
      nextTrialNumber: baseContext.nextTrialNumber,
      epsilon: baseContext.epsilon
    })
  })
