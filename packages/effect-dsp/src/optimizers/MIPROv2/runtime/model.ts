/**
 * Phase 3 runtime models — trial state, binding, and diagnostic snapshots.
 *
 * @since 0.1.0
 * @internal
 */
import type { Ref } from "effect"
import { Data } from "effect"
import type { ModuleParams } from "../../../contracts/ModuleParams.js"
import type { PredictorDemoCandidates } from "../bootstrap.js"
import type { PredictorInstructionCandidates } from "../propose.js"

/**
 * Finite index type representing a single categorical choice within a
 * Phase 3 search dimension. Limited to 0–9 to bound the candidate space.
 *
 * @since 0.1.0
 * @category type-level
 */
export type Phase3DimensionIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

/**
 * A full trial configuration mapping each search dimension name to the
 * chosen candidate index. Dimension names follow the pattern
 * `"<predictor>__demo"` and `"<predictor>__instruction"`.
 *
 * @since 0.1.0
 * @category models
 * @see {@link demoDimensionName}
 * @see {@link instructionDimensionName}
 */
export type Phase3Config = Readonly<Record<string, Phase3DimensionIndex>>

/**
 * Live binding for a single predictor during Phase 3 search.
 *
 * Holds a mutable `Ref` to the current `ModuleParams` along with the
 * complete demo and instruction candidate sets produced by Phases 1 and 2.
 * The search loop writes to `paramsRef` each trial to apply the chosen
 * configuration.
 *
 * @since 0.1.0
 * @category models
 */
export class PredictorBinding extends Data.Class<{
  readonly predictorName: string
  readonly paramsRef: Ref.Ref<ModuleParams>
  readonly demos: PredictorDemoCandidates
  readonly instructions: PredictorInstructionCandidates
}> {}

/**
 * Snapshot of the best-performing trial configuration found so far,
 * capturing both the dimension→index mapping and the averaged evaluation
 * score at the time it was recorded.
 *
 * @since 0.1.0
 * @category models
 * @see {@link Phase3Config}
 */
export class BestAveragingCandidate extends Data.Class<{
  readonly config: Phase3Config
  readonly score: number
}> {}

/**
 * Derives the search-space dimension name for a predictor's demo candidates.
 *
 * @since 0.1.0
 * @category helpers
 */
export const demoDimensionName = (predictorName: string): string => `${predictorName}__demo`

/**
 * Derives the search-space dimension name for a predictor's instruction
 * candidates.
 *
 * @since 0.1.0
 * @category helpers
 */
export const instructionDimensionName = (predictorName: string): string => `${predictorName}__instruction`
