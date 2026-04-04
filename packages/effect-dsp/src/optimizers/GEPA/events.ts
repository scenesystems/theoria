/**
 * GEPA optimizer event contracts.
 *
 * @see {@link https://arxiv.org/abs/2507.19457 | Agrawal et al., "GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning", 2025}
 * @since 0.1.0
 */
import { Data, Schema } from "effect"

/**
 * Schema describing events emitted during GEPA optimization.
 *
 * @since 0.1.0
 * @category events
 */
export const GEPAEventSchema = Schema.Union(
  Schema.TaggedStruct("IterationStarted", {
    iteration: Schema.Number,
    frontierSize: Schema.Number
  }),
  Schema.TaggedStruct("MergeChecked", {
    iteration: Schema.Number,
    attempted: Schema.Boolean,
    accepted: Schema.Boolean,
    mergeBudgetRemaining: Schema.Number
  }),
  Schema.TaggedStruct("MutationProposed", {
    iteration: Schema.Number,
    parentId: Schema.String,
    mutatedCandidateId: Schema.String,
    predictorName: Schema.String,
    instruction: Schema.String
  }),
  Schema.TaggedStruct("AcceptanceEvaluated", {
    iteration: Schema.Number,
    accepted: Schema.Boolean,
    gate1Passed: Schema.Boolean,
    fullValsetEvaluated: Schema.Boolean,
    previousSubsampleSum: Schema.Number,
    mutatedSubsampleSum: Schema.Number
  }),
  Schema.TaggedStruct("ParetoUpdated", {
    iteration: Schema.Number,
    frontierIndices: Schema.Array(Schema.Number),
    dominatedIndices: Schema.Array(Schema.Number),
    parentWeights: Schema.Array(
      Schema.Struct({
        candidateIndex: Schema.Number,
        weight: Schema.Number
      })
    )
  }),
  Schema.TaggedStruct("IterationCompleted", {
    iteration: Schema.Number,
    acceptedCandidate: Schema.Boolean,
    frontierSize: Schema.Number
  }),
  Schema.TaggedStruct("OptimizationCompleted", {
    iterations: Schema.Number,
    bestCandidateId: Schema.String,
    frontierSize: Schema.Number
  })
)

/**
 * Events emitted during GEPA optimization.
 *
 * @since 0.1.0
 * @category events
 */
export type GEPAEvent = typeof GEPAEventSchema.Type

/**
 * Constructors and match helpers for GEPA events.
 *
 * @since 0.1.0
 * @category events
 */
export const GEPAEvent = Data.taggedEnum<GEPAEvent>()
