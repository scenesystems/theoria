/**
 * Trial reservation: sample configurations, decode, and register running trials.
 *
 * @since 0.1.0
 */
import * as History from "@scenesystems/effect-study/History"
import { Clock, Effect, Match, Number as Num, Option, SortedMap, Tuple } from "effect"

import { decodeConfig } from "../../../internal/sampler/decodeConfig.js"
import * as Sampler from "../../../Sampler.js"
import { InvalidStudyConfig, type SearchError } from "../../../SearchError.js"
import type * as SearchSpace from "../../../SearchSpace.js"
import * as Trial from "../../../Trial.js"
import type { OptimizePlan, OptimizeSettings } from "../options/plan.js"
import { markSpaceExhausted } from "./completion.js"
import { contextForSuggestion } from "./context.js"
import { modifyRuntimeState, modifyStudyState, RuntimeState, type StudyRuntime } from "./runtimeState.js"

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
  settings: OptimizeSettings,
  runtime: StudyRuntime<ConfigFor<Space>>,
  sampler: Sampler.Sampler
): Effect.Effect<ConfigFor<Space>, SearchError> =>
  modifyStudyState(runtime, (state) =>
    Effect.gen(function*() {
      const suggestionContext = yield* contextForSuggestion(
        settings.objectiveSpec,
        state,
        settings.priorWeight,
        settings.epsilon,
        sampler.pendingImputationPolicy
      )
      const rawConfig = yield* Sampler.suggest(sampler, options.space, suggestionContext)

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
    settings: OptimizeSettings,
    trialNumber: number,
    runtime: StudyRuntime<ConfigFor<Space>>
  ): Effect.Effect<Trial.Trial<ConfigFor<Space>>, SearchError> =>
    modifyStudyState(runtime, (state) =>
      Effect.gen(function*() {
        const suggestionContext = yield* contextForSuggestion(
          settings.objectiveSpec,
          state,
          settings.priorWeight,
          settings.epsilon,
          options.sampler.pendingImputationPolicy
        )
        const rawConfig = yield* Sampler.suggest(options.sampler, options.space, suggestionContext)
        const config = yield* decodeConfig(
          options.sampler.kind._tag,
          options.space,
          rawConfig,
          `sampler ${options.sampler.kind._tag} generated a config that failed search-space decoding`
        )
        const startedAt = yield* Clock.currentTimeMillis
        const running = Trial.makeRunning(trialNumber, config, startedAt)

        return Tuple.make(running, History.set(state, running))
      }))
)

const closedStudy = (lifecycle: RuntimeState<unknown>["lifecycle"]): InvalidStudyConfig =>
  new InvalidStudyConfig({ reason: `Study.ask requires a running handle (current lifecycle: ${lifecycle})` })

const exhaustedBudget = (): InvalidStudyConfig =>
  new InvalidStudyConfig({
    reason: "Study.ask cannot reserve a trial because the configured trial budget is exhausted"
  })

/** Atomically validates manual admission, allocates the number, and records the reservation. */
export const reserveNextTrialOrMarkSpaceExhausted = <Space extends SearchSpace.SearchSpace>(
  options: OptimizePlan<ConfigFor<Space>, Space>,
  settings: OptimizeSettings,
  runtime: StudyRuntime<ConfigFor<Space>>
): Effect.Effect<Option.Option<Trial.Trial<ConfigFor<Space>>>, SearchError> =>
  modifyRuntimeState(runtime, (runtimeState) =>
    Match.value(runtimeState.lifecycle).pipe(
      Match.when("Running", () => {
        const trialNumber = SortedMap.size(runtimeState.studyState.trials)
        return Match.value(Num.greaterThanOrEqualTo(trialNumber, settings.trials)).pipe(
          Match.when(true, () => Effect.fail(exhaustedBudget())),
          Match.orElse(() =>
            Effect.gen(function*() {
              const suggestionContext = yield* contextForSuggestion(
                settings.objectiveSpec,
                runtimeState.studyState,
                settings.priorWeight,
                settings.epsilon,
                options.sampler.pendingImputationPolicy
              )
              const rawConfig = yield* Sampler.suggest(options.sampler, options.space, suggestionContext)
              const config = yield* decodeConfig(
                options.sampler.kind._tag,
                options.space,
                rawConfig,
                `sampler ${options.sampler.kind._tag} generated a config that failed search-space decoding`
              )
              const running = Trial.makeRunning(trialNumber, config, yield* Clock.currentTimeMillis)
              return Tuple.make(
                running,
                new RuntimeState({
                  lifecycle: runtimeState.lifecycle,
                  studyState: History.set(runtimeState.studyState, running)
                })
              )
            })
          )
        )
      }),
      Match.orElse((lifecycle) => Effect.fail(closedStudy(lifecycle)))
    )).pipe(
      Effect.asSome,
      Effect.catchTag(
        "effect-search/SamplerExhausted",
        () => markSpaceExhausted(runtime.completionReasonRef).pipe(Effect.as(Option.none()))
      )
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
): Effect.Effect<Option.Option<Trial.Trial<ConfigFor<Space>>>, SearchError> =>
  reserveTrial(options, settings, trialNumber, runtime).pipe(
    Effect.asSome,
    Effect.catchTag(
      "effect-search/SamplerExhausted",
      () => markSpaceExhausted(runtime.completionReasonRef).pipe(Effect.as(Option.none()))
    )
  )
