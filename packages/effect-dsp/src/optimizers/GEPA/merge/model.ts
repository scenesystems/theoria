/**
 * GEPA merge/crossover contract models.
 *
 * @since 0.0.0
 */
import { Schema } from "effect"
import { MergeComparison, ProgramCandidate } from "../model.js"

/**
 * Inputs for common-ancestor merge preparation.
 *
 * @since 0.0.0
 * @category models
 */
export type PrepareCommonAncestorMergeOptions = Readonly<{
  readonly candidates: ReadonlyArray<ProgramCandidate>
  readonly parentAId: string
  readonly parentBId: string
  readonly parentAScore: number
  readonly parentBScore: number
  readonly mergedCandidateId: string
  readonly comparisons: ReadonlyArray<MergeComparison>
  readonly mergeBudgetRemaining: number
  readonly seed: number
}>

/**
 * Merge/crossover preparation event emitted before acceptance evaluation.
 *
 * @since 0.0.0
 * @category events
 */
export const MergePreparationEventSchema = Schema.Union(
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
 * @since 0.0.0
 * @category events
 */
export type MergePreparationEvent = typeof MergePreparationEventSchema.Type

/**
 * Merge preparation result.
 *
 * @since 0.0.0
 * @category models
 */
export class MergePreparation extends Schema.Class<MergePreparation>("GEPAMergePreparation")({
  event: MergePreparationEventSchema,
  candidate: Schema.OptionFromSelf(ProgramCandidate),
  subsample: Schema.Array(MergeComparison),
  mergeBudgetRemaining: Schema.Number
}) {}
