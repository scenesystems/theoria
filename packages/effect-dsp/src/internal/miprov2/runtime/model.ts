/**
 * Phase 3 runtime models — trial state, binding, and diagnostic snapshots.
 *
 * @since 0.1.0
 * @internal
 */
import { Data, Schema } from "effect"
import type { Option } from "effect"
import type { PredictorDemoCandidates, PredictorInstructionCandidates } from "../../../MIPROv2Candidates.js"
import type { ModuleParameters } from "../../../ModuleParameters.js"
import type * as Predictor from "../../../Predictor.js"

/**
 * Finite index type representing a single categorical choice within a
 * Phase 3 search dimension. Candidate counts are not artificially capped.
 *
 * @since 0.1.0
 * @category type-level
 */
export const Phase3DimensionIndex = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))

/** @internal */
export type Phase3DimensionIndex = typeof Phase3DimensionIndex.Type

/**
 * A full trial configuration mapping each search dimension name to the
 * chosen candidate index. Dimension names follow the pattern
 * `"<index>_predictor_demos"` and `"<index>_predictor_instruction"`.
 *
 * @since 0.1.0
 * @category models
 * @see {@link demoDimensionName}
 * @see {@link instructionDimensionName}
 */
export const Phase3Config = Schema.Record(Schema.String, Phase3DimensionIndex)

/** @internal */
export type Phase3Config = typeof Phase3Config.Type

/**
 * Candidate binding for a single predictor during Phase 3 search.
 *
 * Pairs a stable predictor path with the complete demo and instruction
 * candidate sets produced by Phases 1 and 2.
 *
 * @since 0.1.0
 * @category models
 */
export class PredictorBinding extends Data.Class<{
  readonly index: number
  readonly predictorName: string
  readonly predictorId: Predictor.Path
  readonly originalParameters: ModuleParameters
  readonly demos: Option.Option<PredictorDemoCandidates>
  readonly instructions: PredictorInstructionCandidates
}> {}

/**
 * Derives the search-space dimension name for a predictor's demo candidates.
 *
 * @since 0.1.0
 * @category helpers
 */
export const demoDimensionName = (index: number): string => `${index}_predictor_demos`

/**
 * Derives the search-space dimension name for a predictor's instruction
 * candidates.
 *
 * @since 0.1.0
 * @category helpers
 */
export const instructionDimensionName = (index: number): string => `${index}_predictor_instruction`
