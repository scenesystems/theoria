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

export { GroupedMixedSettings }

export const suggestGroupedMixedJoint = (
  rng: Rng.Rng,
  nCandidates: number,
  space: SearchSpace.SearchSpace,
  split: TrialSplit,
  settings: GroupedMixedSettings,
  noiseOptions: NoiseBandwidthOptions = defaultNoiseBandwidthOptions,
  acquisition: AcquisitionOption = defaultAcquisitionName
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
                acquisition
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
