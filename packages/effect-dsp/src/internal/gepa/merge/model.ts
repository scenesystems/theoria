/**
 * GEPA merge/crossover contract models.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"
import { MergeComparisons, ProgramCandidate, ProgramCandidates } from "../model.js"

/**
 * Inputs for common-ancestor merge preparation.
 *
 * @since 0.1.0
 * @category models
 */
export const PrepareCommonAncestorMergeOptions = Schema.Struct({
  candidates: ProgramCandidates,
  parentAId: Schema.String,
  parentBId: Schema.String,
  parentAScore: Schema.Number,
  parentBScore: Schema.Number,
  mergedCandidateId: Schema.String,
  comparisons: MergeComparisons,
  mergeBudgetRemaining: Schema.Number,
  seed: Schema.Number
})

/**
 * Inputs for common-ancestor merge preparation.
 *
 * @since 0.1.0
 * @category models
 */
export type PrepareCommonAncestorMergeOptions = typeof PrepareCommonAncestorMergeOptions.Type

/** @internal */
export const MergePredictorInstructionsOptions = Schema.Struct({
  ancestor: ProgramCandidate,
  parentA: ProgramCandidate,
  parentB: ProgramCandidate,
  parentAScore: Schema.Number,
  parentBScore: Schema.Number
})

/** @internal */
export type MergePredictorInstructionsOptions = typeof MergePredictorInstructionsOptions.Type

/**
 * Merge/crossover preparation event emitted before acceptance evaluation.
 *
 * @since 0.1.0
 * @category events
 */
export const MergePreparationEvent = Schema.Union(
  Schema.TaggedStruct("MergeSkippedNoCommonAncestor", {
    parentAId: Schema.String,
    parentBId: Schema.String
  }),
  Schema.TaggedStruct("MergePrepared", {
    parentAId: Schema.String,
    parentBId: Schema.String,
    commonAncestorId: Schema.String
  })
)

/**
 * Merge/crossover preparation event emitted before acceptance evaluation.
 *
 * @since 0.1.0
 * @category events
 */
export type MergePreparationEvent = typeof MergePreparationEvent.Type

/**
 * Merge preparation result.
 *
 * @since 0.1.0
 * @category models
 */
export class MergePreparation extends Schema.Class<MergePreparation>("GEPAMergePreparation")({
  event: MergePreparationEvent,
  candidate: Schema.OptionFromSelf(ProgramCandidate),
  subsample: MergeComparisons,
  mergeBudgetRemaining: Schema.Number
}) {}
