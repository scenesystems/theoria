/**
 * Adapts effect-search study operations and result projections for DSP optimizers.
 *
 * @since 0.1.0
 */
import type { Value as ObjectiveValue } from "@scenesystems/effect-search/Objective"
import * as Optimization from "@scenesystems/effect-search/Optimization"
import * as Pareto from "@scenesystems/effect-search/Pareto"
import * as Sampler from "@scenesystems/effect-search/Sampler"
import type { SearchError } from "@scenesystems/effect-search/SearchError"
import type * as SearchSpace from "@scenesystems/effect-search/SearchSpace"
import type * as Journal from "@scenesystems/effect-study/Journal"
import { Array as Arr, Data, type Effect, Match, Option } from "effect"
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
 * Creates a TPE sampler from the adapter's resolved options.
 *
 * @remarks
 * Omitted fields use `defaultEffectSearchTpeSamplerOptions`. Supplying a
 * seed selects deterministic sampling for otherwise equal study inputs.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeTpeSampler = (options: EffectSearchTpeSamplerInput = {}): Sampler.Sampler => {
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

const openDirectionalOptimization = <Space extends SearchSpace.SearchSpace>(
  options: EffectSearchOpenOptions<Space>
): Effect.Effect<Optimization.Optimization<Space>, SearchError, Scope.Scope> => {
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
    Match.when("maximize", () => Optimization.open({ ...baseOptions, direction: "maximize" })),
    Match.when("minimize", () => Optimization.open({ ...baseOptions, direction: "minimize" })),
    Match.exhaustive
  )
}

/**
 * Acquires a scoped manual study for external objective evaluation.
 *
 * @remarks
 * The enclosing `Scope` owns the handle and closes it during finalization.
 * Study configuration and sampler initialization fail through `SearchError`.
 *
 * @typeParam Space - Search-space schema that determines each asked configuration.
 *
 * @since 0.1.0
 * @category combinators
 */
export const open = <Space extends SearchSpace.SearchSpace>(
  options: EffectSearchOpenOptions<Space>
): Effect.Effect<EffectSearchInteropHandle<Space>, SearchError, Scope.Scope> => openDirectionalOptimization(options)

/**
 * Reserves the next sampled configuration as a pending trial.
 *
 * @remarks
 * The trial remains pending until reported through {@link tell} or
 * {@link fail}. Closed handles, exhausted budgets or spaces, and suggestion
 * failures produce `SearchError`.
 *
 * @typeParam Space - Search-space schema retained by the study handle.
 *
 * @since 0.1.0
 * @category combinators
 */
export const ask = <Space extends SearchSpace.SearchSpace>(
  handle: EffectSearchInteropHandle<Space>
): Effect.Effect<EffectSearchAskedTrial<SearchSpace.Type<Space>>, SearchError> => Optimization.ask(handle)

/**
 * Completes a pending trial with an externally evaluated objective value.
 *
 * @remarks
 * The value must be finite and match the study's objective arity. Unknown,
 * finalized, or closed trials fail through `SearchError`.
 *
 * @typeParam Space - Search-space schema retained by the study handle.
 *
 * @since 0.1.0
 * @category combinators
 */
export const tell = <Space extends SearchSpace.SearchSpace>(
  handle: EffectSearchInteropHandle<Space>,
  trialNumber: number,
  value: ObjectiveValue
): Effect.Effect<void, SearchError> => Optimization.tell(handle, trialNumber, value)

/**
 * Finalizes a pending trial with a retained failure cause.
 *
 * @remarks
 * A string `message` property is copied when present; other causes use the
 * effect-search manual-failure message. Unknown, finalized, or closed trials
 * fail through `SearchError`.
 *
 * @typeParam Space - Search-space schema retained by the study handle.
 *
 * @since 0.1.0
 * @category combinators
 */
export const fail = <Space extends SearchSpace.SearchSpace>(
  handle: EffectSearchInteropHandle<Space>,
  trialNumber: number,
  cause: unknown
): Effect.Effect<void, SearchError> => Optimization.fail(handle, trialNumber, cause)

/**
 * Closes a running study with completion reason `interrupted`.
 *
 * @remarks
 * Pending trials remain in their running state in later snapshots and results.
 * Repeated cancellation does not emit another completion event. Completion
 * event persistence can fail with `Journal.Failure`.
 *
 * @typeParam Space - Search-space schema retained by the study handle.
 *
 * @since 0.1.0
 * @category combinators
 */
export const cancel = <Space extends SearchSpace.SearchSpace>(
  handle: EffectSearchInteropHandle<Space>
): Effect.Effect<void, Journal.Failure> => Optimization.cancel(handle)

/**
 * Captures the handle's current trials and compatibility metadata for resume.
 *
 * @remarks
 * The snapshot omits event history and retains pending trials in their current
 * state.
 *
 * @typeParam Space - Search-space schema retained by the study handle.
 *
 * @since 0.1.0
 * @category combinators
 */
export const snapshot = <Space extends SearchSpace.SearchSpace>(
  handle: EffectSearchInteropHandle<Space>
) => Optimization.snapshot(handle)

/**
 * Builds the final result after the handle completes or is cancelled.
 *
 * @remarks
 * Calling this while the handle can still accept reports fails with
 * `InvalidOptimizationConfig`. Sampler checkpoint and result construction failures
 * remain in `SearchError`.
 *
 * @typeParam Space - Search-space schema decoded into result trial configurations.
 *
 * @see {@link resultSummary} for a portable projection of the result
 * @since 0.1.0
 * @category combinators
 */
export const result = <Space extends SearchSpace.SearchSpace>(
  handle: EffectSearchInteropHandle<Space>
): Effect.Effect<Optimization.Result<SearchSpace.Type<Space>>, SearchError> => Optimization.result(handle)

/**
 * Projects a study result into counts and optional single-objective incumbent data.
 *
 * @remarks
 * Multi-objective results omit `bestTrialNumber` and `bestObjective`; their
 * `paretoCount` is the final frontier size. Single-objective results report one
 * Pareto entry.
 *
 * @typeParam Config - Decoded configuration retained by every result trial.
 *
 * @see {@link result} for obtaining the full study result
 * @since 0.1.0
 * @category constructors
 */
export const resultSummary = <Config>(result: Optimization.Result<Config>): EffectSearchResultSummary =>
  Match.value(result).pipe(
    Match.tag(
      "SingleObjective",
      ({ bestTrial, trials }) =>
        new EffectSearchResultSummary({
          kind: "SingleObjective",
          trialCount: Arr.length(Arr.fromIterable(trials)),
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
          trialCount: Arr.length(Arr.fromIterable(trials)),
          bestTrialNumber: Option.none(),
          bestObjective: Option.none(),
          paretoCount: Arr.length(Arr.fromIterable(paretoFront))
        })
    ),
    Match.exhaustive
  )

/**
 * Exposes effect-search Pareto operations without changing their contracts.
 *
 * @since 0.1.0
 * @category re-exports
 */
export class ParetoOperations extends Data.Class<{
  readonly dominates: typeof Pareto.dominates
  readonly nonDominatedIndices: typeof Pareto.nonDominatedIndices
  readonly nonDominatedSort: typeof Pareto.nonDominatedSort
  readonly nonDominatedRanks: typeof Pareto.nonDominatedRanks
  readonly hypervolume2d: typeof Pareto.hypervolume2d
  readonly hypervolumeContribution2d: typeof Pareto.hypervolumeContribution2d
}> {}

export const pareto = new ParetoOperations({
  dominates: Pareto.dominates,
  nonDominatedIndices: Pareto.nonDominatedIndices,
  nonDominatedSort: Pareto.nonDominatedSort,
  nonDominatedRanks: Pareto.nonDominatedRanks,
  hypervolume2d: Pareto.hypervolume2d,
  hypervolumeContribution2d: Pareto.hypervolumeContribution2d
})
