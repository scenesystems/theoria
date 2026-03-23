/**
 * MIPROv2 optimizer event contracts.
 *
 * @see {@link https://arxiv.org/abs/2406.11695 | Opsahl-Ong et al., "Optimizing Instructions and Demonstrations for Multi-Stage Language Model Programs", 2024}
 * @since 0.0.0
 */
import { Data, Schema } from "effect"

/**
 * Schema describing events emitted during MIPROv2 optimization.
 *
 * @since 0.0.0
 * @category events
 */
export const MIPROv2EventSchema = Schema.Union(
  Schema.TaggedStruct("Phase1Started", {
    numCandidates: Schema.Number
  }),
  Schema.TaggedStruct("DemoCandidate", {
    predictorIndex: Schema.Number,
    candidateIndex: Schema.Number
  }),
  Schema.TaggedStruct("Phase1Completed", {
    totalCandidates: Schema.Number
  }),
  Schema.TaggedStruct("Phase2Started", {
    numInstructions: Schema.Number
  }),
  Schema.TaggedStruct("InstructionProposed", {
    predictorIndex: Schema.Number,
    instruction: Schema.String
  }),
  Schema.TaggedStruct("Phase2Completed", {
    totalInstructions: Schema.Number
  }),
  Schema.TaggedStruct("Phase3Started", {
    numTrials: Schema.Number
  }),
  Schema.TaggedStruct("TrialEvaluated", {
    trial: Schema.Number,
    score: Schema.Number
  }),
  Schema.TaggedStruct("FullEvalCompleted", {
    bestScore: Schema.Number
  }),
  Schema.TaggedStruct("Phase3Completed", {
    bestScore: Schema.Number,
    totalTrials: Schema.Number
  })
)

/**
 * Events emitted during MIPROv2 optimization.
 *
 * @since 0.0.0
 * @category events
 */
export type MIPROv2Event = typeof MIPROv2EventSchema.Type

/**
 * Constructors and match helpers for MIPROv2 events.
 *
 * @since 0.0.0
 * @category events
 */
export const MIPROv2Event = Data.taggedEnum<MIPROv2Event>()
