/**
 * Durable per-trial journaling with the sampler checkpoint that accompanies each trial.
 *
 * @since 0.9.0
 */
import { Effect, Option } from "effect"

import * as OptimizationSnapshot from "../../OptimizationSnapshot.js"
import * as OptimizationStorage from "../../OptimizationStorage.js"
import * as Sampler from "../../Sampler.js"
import type { SearchError } from "../../SearchError.js"
import type * as Trial from "../../Trial.js"

/**
 * Appends a trial record carrying the sampler's current checkpoint when optimization
 * storage is present. Callers run this inside the study transaction that serializes
 * suggestions, so the checkpoint never reflects a partial suggestion and journal order
 * matches stream order. Without storage, the sampler is not checkpointed.
 *
 * @since 0.9.0
 * @category utils
 */
export const journalTrial = <Config>(
  sampler: Sampler.Sampler,
  trial: Trial.Trial<Config>
): Effect.Effect<void, SearchError> =>
  Effect.serviceOption(OptimizationStorage.OptimizationStorage).pipe(
    Effect.flatMap(Option.match({
      onNone: () => Effect.void,
      onSome: (storage) =>
        Sampler.checkpoint(sampler).pipe(
          Effect.flatMap((samplerCheckpoint) =>
            storage.appendTrial(OptimizationSnapshot.makeTrialRecord(trial, samplerCheckpoint))
          )
        )
    }))
  )
