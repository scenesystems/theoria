/**
 * TPE grouped mixed suggestion — sequential group-wise joint sampling with config merging.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Match, Option } from "effect"

import type { InvalidSamplerConfig } from "../../Errors/index.js"
import type * as Rng from "../../internal/rng.js"
import { defaultNoiseBandwidthOptions, type NoiseBandwidthOptions } from "../../internal/tpe/noiseEstimator.js"
import type { TrialSplit } from "../../internal/tpe/splitTrials.js"
import type * as SearchSpace from "../../SearchSpace/index.js"
import { type AcquisitionOption, defaultAcquisitionName } from "./acquisition/index.js"
import { activeGroupParameters, orderedGroups } from "./groupedMixed/groups.js"
import { GroupedMixedSettings } from "./groupedMixed/model.js"
import { mergeConfigs, suggestGroup } from "./groupedMixed/scoring.js"
import type { PreparedTpeModelContext } from "./preparedModel.js"

export {
  /**
   * Feature flags controlling multivariate and group-dimensions behavior.
   *
   * @since 0.1.0
   * @category models
   */
  GroupedMixedSettings
}

/**
 * Suggests a full configuration by sampling each conditional parameter
 * group in depth order, merging partial configs between groups. This
 * is the top-level entry point for grouped-mixed TPE — it handles
 * conditional activation, group decomposition, and config accumulation
 * so callers receive a single complete config.
 *
 * @see {@link orderedGroups} for group decomposition
 * @see {@link suggestGroup} for per-group candidate generation
 * @see {@link GroupedMixedSettings} for feature flag control
 * @since 0.1.0
 * @category sampling
 */
export const suggestGroupedMixedJoint = (
  rng: Rng.Rng,
  nCandidates: number,
  space: SearchSpace.SearchSpace,
  split: TrialSplit,
  settings: GroupedMixedSettings,
  noiseOptions: NoiseBandwidthOptions = defaultNoiseBandwidthOptions,
  acquisition: AcquisitionOption = defaultAcquisitionName,
  preparedModelContext: Option.Option<PreparedTpeModelContext> = Option.none()
): Effect.Effect<unknown, InvalidSamplerConfig> => {
  const groups = orderedGroups(space, settings)

  const go = (index: number, partialConfig: unknown): Effect.Effect<unknown, InvalidSamplerConfig> =>
    Arr.get(groups, index).pipe(
      Option.match({
        onNone: () => Effect.succeed(partialConfig),
        onSome: (group) => {
          const activeParameters = activeGroupParameters(space, group, partialConfig)

          return Match.value(activeParameters.length <= 0).pipe(
            Match.when(true, () => go(index + 1, partialConfig)),
            Match.orElse(() =>
              suggestGroup(
                rng,
                nCandidates,
                activeParameters,
                split,
                settings,
                noiseOptions,
                acquisition,
                preparedModelContext
              ).pipe(
                Effect.flatMap((groupSuggestion) => go(index + 1, mergeConfigs(partialConfig, groupSuggestion)))
              )
            )
          )
        }
      })
    )

  return go(0, {})
}
