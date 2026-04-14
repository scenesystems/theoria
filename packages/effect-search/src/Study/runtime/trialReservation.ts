/**
 * Trial reservation: sample configurations, decode, and register running trials.
 *
 * @since 0.1.0
 */
import { Data, Effect, Option, Tuple } from "effect"

import { SuggestionDiagnostics } from "../../contracts/SuggestionDiagnostics.js"
import type { SearchError } from "../../Errors/index.js"
import { PendingImputationPolicySpiLayer } from "../../Sampler/index.js"
import * as Sampler from "../../Sampler/index.js"
import type { PreparedSuggestionState } from "../../Sampler/preparation.js"
import { decodeConfig } from "../../Sampler/shared/decodeConfig.js"
import type * as SearchSpace from "../../SearchSpace/index.js"
import { Trial } from "../../Trial/index.js"
import type { OptimizePlan, OptimizeSettings } from "../options.js"
import { withReservedTrial } from "../state.js"
import { markSpaceExhausted } from "./completion.js"
import { contextForSuggestionState } from "./context.js"
import { RuntimeState } from "./runtimeState.js"
import { modifyRuntimeState, StudyClock, type StudyRuntime } from "./runtimeState.js"

type ConfigFor<Space extends SearchSpace.SearchSpace> = SearchSpace.Type<Space>

/**
 * Reservation-local result that keeps the running trial and its diagnostics
 * bound together atomically.
 *
 * @since 0.3.0
 * @category models
 */
export class ReservedTrial<Config = unknown> extends Data.Class<{
  readonly running: Trial<Config>
  readonly diagnostics: Option.Option<SuggestionDiagnostics>
}> {}

const suggestWithPreparedState = <Space extends SearchSpace.SearchSpace>(
  options: OptimizePlan<ConfigFor<Space>, Space>,
  sampler: Sampler.Sampler,
  suggestionContext: Sampler.SuggestContext,
  previous: Option.Option<PreparedSuggestionState>
): Effect.Effect<
  readonly [unknown, Option.Option<PreparedSuggestionState>, SuggestionDiagnostics],
  SearchError
> =>
  Option.fromNullable(sampler.prepareSuggestion).pipe(
    Option.match({
      onNone: () =>
        Sampler.SamplerSpi.suggest(options.space, suggestionContext).pipe(
          Effect.provide(Sampler.SamplerSpiLayer(sampler)),
          Effect.map((rawConfig) =>
            Tuple.make(
              rawConfig,
              previous,
              SuggestionDiagnostics.fromContext(sampler.kind._tag, "none", false, suggestionContext)
            )
          )
        ),
      onSome: (prepareSuggestion) =>
        prepareSuggestion(options.space, suggestionContext, previous).pipe(
          Effect.flatMap(([preparedSuggestion, diagnostics]) =>
            Option.fromNullable(sampler.suggestPrepared).pipe(
              Option.match({
                onNone: () =>
                  Sampler.SamplerSpi.suggest(options.space, suggestionContext).pipe(
                    Effect.provide(Sampler.SamplerSpiLayer(sampler)),
                    Effect.map((rawConfig) => Tuple.make(rawConfig, Option.some(preparedSuggestion), diagnostics))
                  ),
                onSome: (suggestPrepared) =>
                  suggestPrepared(options.space, suggestionContext, preparedSuggestion).pipe(
                    Effect.map((rawConfig) => Tuple.make(rawConfig, Option.some(preparedSuggestion), diagnostics))
                  )
              })
            )
          )
        )
    })
  )

/**
 * Samples a single configuration from the search space using the plan's default sampler.
 *
 * @since 0.1.0
 * @category utils
 */
export const suggestConfig = <Space extends SearchSpace.SearchSpace>(
  options: OptimizePlan<ConfigFor<Space>, Space>,
  settings: OptimizeSettings,
  runtime: StudyRuntime<ConfigFor<Space>>
): Effect.Effect<ConfigFor<Space>, SearchError> => suggestConfigWithSampler(options, settings, runtime, options.sampler)

/**
 * Samples a single configuration using an explicitly provided sampler instead of the plan default.
 *
 * @since 0.1.0
 * @category utils
 */
export const suggestConfigWithSampler = <Space extends SearchSpace.SearchSpace>(
  options: OptimizePlan<ConfigFor<Space>, Space>,
  _settings: OptimizeSettings,
  runtime: StudyRuntime<ConfigFor<Space>>,
  sampler: Sampler.Sampler
): Effect.Effect<ConfigFor<Space>, SearchError> =>
  modifyRuntimeState(runtime, (state) =>
    Effect.gen(function*() {
      const suggestionContext = yield* contextForSuggestionState(state.suggestionState).pipe(
        Effect.provide(PendingImputationPolicySpiLayer(sampler.pendingImputationPolicy))
      )
      const [rawConfig, preparedSuggestion, diagnostics] = yield* suggestWithPreparedState(
        options,
        sampler,
        suggestionContext,
        state.suggestionState.preparedSuggestion
      )
      void diagnostics

      const config = yield* decodeConfig(
        sampler.kind._tag,
        options.space,
        rawConfig,
        `sampler ${sampler.kind._tag} generated a config that failed search-space decoding`
      )

      return Tuple.make(
        config,
        new RuntimeState({
          lifecycle: state.lifecycle,
          studyState: state.studyState,
          suggestionState: state.suggestionState.withPreparedSuggestion(preparedSuggestion)
        })
      )
    }))

const reserveTrial = Effect.fn("effect-search/Study.reserveTrial")(
  <Space extends SearchSpace.SearchSpace>(
    options: OptimizePlan<ConfigFor<Space>, Space>,
    _settings: OptimizeSettings,
    trialNumber: number,
    runtime: StudyRuntime<ConfigFor<Space>>
  ): Effect.Effect<ReservedTrial<ConfigFor<Space>>, SearchError, StudyClock> =>
    modifyRuntimeState(runtime, (state) =>
      Effect.gen(function*() {
        const clock = yield* StudyClock
        const suggestionContext = yield* contextForSuggestionState(state.suggestionState).pipe(
          Effect.provide(PendingImputationPolicySpiLayer(options.sampler.pendingImputationPolicy))
        )
        const [rawConfig, preparedSuggestion, diagnostics] = yield* suggestWithPreparedState(
          options,
          options.sampler,
          suggestionContext,
          state.suggestionState.preparedSuggestion
        )
        const config = yield* decodeConfig(
          options.sampler.kind._tag,
          options.space,
          rawConfig,
          `sampler ${options.sampler.kind._tag} generated a config that failed search-space decoding`
        )
        const startedAt = yield* clock.now
        const running = Trial.run(trialNumber, config, startedAt)

        const nextStudyState = withReservedTrial(state.studyState, running)
        const nextSuggestionState = state.suggestionState.withReservedTrial(running)

        return Tuple.make(
          new ReservedTrial({
            running,
            diagnostics: Option.some(diagnostics)
          }),
          new RuntimeState({
            lifecycle: state.lifecycle,
            studyState: nextStudyState,
            suggestionState: nextSuggestionState.withPreparedSuggestion(preparedSuggestion)
          })
        )
      }))
)

/**
 * Attempts to reserve a trial; on SamplerExhausted, marks the space as exhausted and returns None.
 *
 * @since 0.1.0
 * @category utils
 */
export const reserveTrialOrMarkSpaceExhausted = <Space extends SearchSpace.SearchSpace>(
  options: OptimizePlan<ConfigFor<Space>, Space>,
  settings: OptimizeSettings,
  trialNumber: number,
  runtime: StudyRuntime<ConfigFor<Space>>
): Effect.Effect<Option.Option<ReservedTrial<ConfigFor<Space>>>, SearchError, StudyClock> =>
  reserveTrial(options, settings, trialNumber, runtime).pipe(
    Effect.map(Option.some),
    Effect.catchTag(
      "effect-search/SamplerExhausted",
      () => markSpaceExhausted(runtime.completionReasonRef).pipe(Effect.as(Option.none()))
    )
  )
