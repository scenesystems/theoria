/**
 * TPE grouped mixed suggestion — sequential group-wise joint sampling with config merging.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Effect, Match, Number as Num, Option } from "effect"

import * as Acquisition from "../../Acquisition.js"
import type * as Rng from "../../internal/rng.js"
import { defaultNoiseBandwidthOptions, type NoiseBandwidthOptions } from "../../internal/tpe/noiseEstimator.js"
import type { TrialSplit } from "../../internal/tpe/splitTrials.js"
import type { InvalidSamplerConfig } from "../../SearchError.js"
import type * as SearchSpace from "../../SearchSpace.js"
import { activeGroupParameters, orderedGroups } from "./groupedMixed/groups.js"
import { mergeConfigs, suggestGroup } from "./groupedMixed/scoring.js"

/** Feature flags for correlated kernels and conditional-group decomposition. */
export class GroupedMixedSettings extends Data.Class<{
  readonly multivariate: boolean
  readonly groupDimensions: boolean
}> {}

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
  acquisition: Acquisition.Strategy = Acquisition.defaultName
): Effect.Effect<unknown, InvalidSamplerConfig> => {
  const groups = orderedGroups(space, settings)

  const go = (index: number, partialConfig: unknown): Effect.Effect<unknown, InvalidSamplerConfig> =>
    Arr.get(groups, index).pipe(
      Option.match({
        onNone: () => Effect.succeed(partialConfig),
        onSome: (group) => {
          const activeParameters = activeGroupParameters(space, group, partialConfig)

          return Match.value(Num.lessThanOrEqualTo(Arr.length(activeParameters), 0)).pipe(
            Match.when(true, () => go(Num.increment(index), partialConfig)),
            Match.orElse(() =>
              suggestGroup(
                rng,
                nCandidates,
                activeParameters,
                split,
                settings,
                noiseOptions,
                acquisition
              ).pipe(
                Effect.flatMap((groupSuggestion) =>
                  go(Num.increment(index), mergeConfigs(partialConfig, groupSuggestion))
                )
              )
            )
          )
        }
      })
    )

  return go(0, {})
}
