/**
 * Ask/tell protocol implementation — translates effect-search trial
 * suggestions into module parameter configurations and projects evaluation
 * results back.
 *
 * @since 0.0.0
 */
import { type Effect, Match, Option } from "effect"
import { Pareto, Sampler, Study } from "effect-search"
import type { ObjectiveValue } from "effect-search/Contracts"
import type { SearchError } from "effect-search/Errors"
import type * as SearchSpace from "effect-search/SearchSpace"
import type * as Scope from "effect/Scope"

import {
  defaultEffectSearchTpeSamplerOptions,
  type EffectSearchAskedTrial,
  type EffectSearchInteropHandle,
  type EffectSearchOpenOptions,
  EffectSearchResultSummary,
  type EffectSearchTpeSamplerInput,
  EffectSearchTpeSamplerOptions
} from "./model.js"

const resolveTpeSamplerOptions = (options: EffectSearchTpeSamplerInput = {}): EffectSearchTpeSamplerOptions =>
  new EffectSearchTpeSamplerOptions({
    seed: Option.fromNullable(options.seed),
    multivariate: Option.getOrElse(
      Option.fromNullable(options.multivariate),
      () => defaultEffectSearchTpeSamplerOptions.multivariate
    ),
    acquisition: Option.getOrElse(
      Option.fromNullable(options.acquisition),
      () => defaultEffectSearchTpeSamplerOptions.acquisition
    )
  })

/**
 * Build a Tree-structured Parzen Estimator (TPE) sampler with optional seed,
 * multivariate flag, and acquisition strategy. Unspecified options fall back to
 * {@link import("./model.js").defaultEffectSearchTpeSamplerOptions}.
 *
 * @since 0.0.0
 * @category constructors
 */
export const makeTpeSampler = (options: EffectSearchTpeSamplerInput = {}) => {
  const resolved = resolveTpeSamplerOptions(options)

  return Sampler.tpe({
    ...Option.match(resolved.seed, {
      onNone: () => ({}),
      onSome: (seed) => ({ seed })
    }),
    multivariate: resolved.multivariate,
    acquisition: resolved.acquisition
  })
}

const openDirectionalStudy = <Space extends SearchSpace.SearchSpace>(
  options: EffectSearchOpenOptions<Space>
): Effect.Effect<Study.StudyHandle<Space>, SearchError, Scope.Scope> => {
  const baseOptions = {
    space: options.space,
    sampler: options.sampler,
    trials: options.trials,
    objective: options.objective,
    ...Option.match(Option.fromNullable(options.concurrency), {
      onNone: () => ({}),
      onSome: (concurrency) => ({ concurrency })
    })
  }

  return Match.value(options.direction).pipe(
    Match.when("maximize", () => Study.open({ ...baseOptions, direction: "maximize" })),
    Match.when("minimize", () => Study.open({ ...baseOptions, direction: "minimize" })),
    Match.exhaustive
  )
}

/**
 * Open a scoped study handle for manual ask/tell orchestration. The handle is
 * finalized when its `Scope` closes.
 *
 * @since 0.0.0
 * @category combinators
 */
export const open = <Space extends SearchSpace.SearchSpace>(
  options: EffectSearchOpenOptions<Space>
): Effect.Effect<EffectSearchInteropHandle<Space>, SearchError, Scope.Scope> => openDirectionalStudy(options)

/**
 * Reserve one trial from the study — returns a suggested parameter
 * configuration that the caller should evaluate.
 *
 * @since 0.0.0
 * @category combinators
 */
export const ask = <Space extends SearchSpace.SearchSpace>(
  handle: EffectSearchInteropHandle<Space>
): Effect.Effect<EffectSearchAskedTrial<SearchSpace.Type<Space>>, SearchError> => Study.ask(handle)

/**
 * Report a successful objective value for a previously reserved trial number.
 *
 * @since 0.0.0
 * @category combinators
 */
export const tell = <Space extends SearchSpace.SearchSpace>(
  handle: EffectSearchInteropHandle<Space>,
  trialNumber: number,
  value: ObjectiveValue
): Effect.Effect<void, SearchError> => Study.tell(handle, trialNumber, value)

/**
 * Mark a previously reserved trial as failed so it does not bias future
 * sampling.
 *
 * @since 0.0.0
 * @category combinators
 */
export const fail = <Space extends SearchSpace.SearchSpace>(
  handle: EffectSearchInteropHandle<Space>,
  trialNumber: number,
  cause: unknown
): Effect.Effect<void, SearchError> => Study.fail(handle, trialNumber, cause)

/**
 * Cancel a running study and complete its event stream. Outstanding trials are
 * discarded.
 *
 * @since 0.0.0
 * @category combinators
 */
export const cancel = <Space extends SearchSpace.SearchSpace>(
  handle: EffectSearchInteropHandle<Space>
): Effect.Effect<void> => Study.cancel(handle)

/**
 * Capture a serializable snapshot of the study state for persistence or
 * resume workflows.
 *
 * @since 0.0.0
 * @category combinators
 */
export const snapshot = <Space extends SearchSpace.SearchSpace>(
  handle: EffectSearchInteropHandle<Space>
) => Study.snapshot(handle)

/**
 * Compute the final study result once all trials have been told or failed.
 *
 * @see {@link resultSummary} for a portable projection of the result
 * @since 0.0.0
 * @category combinators
 */
export const result = <Space extends SearchSpace.SearchSpace>(
  handle: EffectSearchInteropHandle<Space>
): Effect.Effect<Study.StudyResult<SearchSpace.Type<Space>>, SearchError> => Study.result(handle)

/**
 * Project a `StudyResult` into a portable {@link EffectSearchResultSummary}
 * that is insulated from upstream result-shape changes.
 *
 * @see {@link result} for obtaining the full study result
 * @since 0.0.0
 * @category constructors
 */
export const resultSummary = <Config>(result: Study.StudyResult<Config>): EffectSearchResultSummary =>
  Match.value(result).pipe(
    Match.tag(
      "SingleObjective",
      ({ bestTrial, trials }) =>
        new EffectSearchResultSummary({
          kind: "SingleObjective",
          trialCount: trials.length,
          bestTrialNumber: Option.some(bestTrial.trialNumber),
          bestObjective: Option.some(bestTrial.state.value),
          paretoCount: 1
        })
    ),
    Match.tag(
      "MultiObjective",
      ({ paretoFront, trials }) =>
        new EffectSearchResultSummary({
          kind: "MultiObjective",
          trialCount: trials.length,
          bestTrialNumber: Option.none(),
          bestObjective: Option.none(),
          paretoCount: paretoFront.length
        })
    ),
    Match.exhaustive
  )

/**
 * Pareto-front utilities re-exported from effect-search — dominance checks,
 * non-dominated sorting, ranks, and 2-D hypervolume computation.
 *
 * @since 0.0.0
 * @category re-exports
 */
export const pareto = {
  dominates: Pareto.dominates,
  nonDominatedIndices: Pareto.nonDominatedIndices,
  nonDominatedSort: Pareto.nonDominatedSort,
  nonDominatedRanks: Pareto.nonDominatedRanks,
  hypervolume2d: Pareto.hypervolume2d,
  hypervolumeContribution2d: Pareto.hypervolumeContribution2d
}
