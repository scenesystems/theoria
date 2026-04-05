/**
 * Trial reservation: sample configurations, decode, and register running trials.
 *
 * @since 0.1.0
 */
import { Effect, Option, Tuple } from "effect"

import type { SearchError } from "../../Errors/index.js"
import { PendingImputationPolicySpiLayer } from "../../Sampler/index.js"
import * as Sampler from "../../Sampler/index.js"
import { decodeConfig } from "../../Sampler/shared/decodeConfig.js"
import type * as SearchSpace from "../../SearchSpace/index.js"
import * as Trial from "../../Trial/index.js"
import type { OptimizePlan, OptimizeSettings } from "../options.js"
import { withReservedTrial } from "../state.js"
import { markSpaceExhausted } from "./completion.js"
import { contextForSuggestionState } from "./context.js"
import { RuntimeState } from "./runtimeState.js"
import { modifyRuntimeState, StudyClock, type StudyRuntime } from "./runtimeState.js"
import { withReservedTrialSuggestionState } from "./suggestionState.js"

type ConfigFor<Space extends SearchSpace.SearchSpace> = SearchSpace.Type<Space>

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
      const rawConfig = yield* Sampler.SamplerSpi.suggest(options.space, suggestionContext).pipe(
        Effect.provide(Sampler.SamplerSpiLayer(sampler))
      )

      const config = yield* decodeConfig(
        sampler.kind._tag,
        options.space,
        rawConfig,
        `sampler ${sampler.kind._tag} generated a config that failed search-space decoding`
      )

      return Tuple.make(config, state)
    }))

const reserveTrial = Effect.fn("effect-search/Study.reserveTrial")(
  <Space extends SearchSpace.SearchSpace>(
    options: OptimizePlan<ConfigFor<Space>, Space>,
    _settings: OptimizeSettings,
    trialNumber: number,
    runtime: StudyRuntime<ConfigFor<Space>>
  ): Effect.Effect<Trial.Trial<ConfigFor<Space>>, SearchError, StudyClock> =>
    modifyRuntimeState(runtime, (state) =>
      Effect.gen(function*() {
        const clock = yield* StudyClock
        const suggestionContext = yield* contextForSuggestionState(state.suggestionState).pipe(
          Effect.provide(PendingImputationPolicySpiLayer(options.sampler.pendingImputationPolicy))
        )
        const rawConfig = yield* Sampler.SamplerSpi.suggest(options.space, suggestionContext).pipe(
          Effect.provide(Sampler.SamplerSpiLayer(options.sampler))
        )
        const config = yield* decodeConfig(
          options.sampler.kind._tag,
          options.space,
          rawConfig,
          `sampler ${options.sampler.kind._tag} generated a config that failed search-space decoding`
        )
        const startedAt = yield* clock.now
        const running = Trial.makeRunning(trialNumber, config, startedAt)

        const nextStudyState = withReservedTrial(state.studyState, running)
        const nextSuggestionState = withReservedTrialSuggestionState(state.suggestionState, running)

        return Tuple.make(
          running,
          new RuntimeState({
            lifecycle: state.lifecycle,
            studyState: nextStudyState,
            suggestionState: nextSuggestionState
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
): Effect.Effect<Option.Option<Trial.Trial<ConfigFor<Space>>>, SearchError, StudyClock> =>
  reserveTrial(options, settings, trialNumber, runtime).pipe(
    Effect.map(Option.some),
    Effect.catchTag(
      "effect-search/SamplerExhausted",
      () => markSpaceExhausted(runtime.completionReasonRef).pipe(Effect.as(Option.none()))
    )
  )
