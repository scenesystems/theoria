/**
 * Defines the closed lifecycle event protocol emitted by MIPROv2.
 *
 * @see {@link https://arxiv.org/abs/2406.11695 | Opsahl-Ong et al., "Optimizing Instructions and Demonstrations for Multi-Stage Language Model Programs", 2024}
 * @since 0.1.0
 */
import { Data, Schema } from "effect"

/**
 * Decodes phase boundaries, generated candidates, and trial evaluations.
 *
 * @remarks
 * `Phase1Started.numCandidates` and `Phase2Started.numInstructions` preserve
 * the caller-supplied values. Completed-phase counts report materialized
 * candidates. Phase 3 reports its normalized trial budget. `TrialEvaluated`
 * carries a minibatch score; `FullEvalCompleted.bestScore` is the running
 * maximum after a full-set checkpoint.
 *
 * @since 0.1.0
 * @category events
 */
export const MIPROv2EventSchema = Schema.Union(
  Schema.TaggedStruct("Phase1Started", {
    /** Caller-supplied demonstration candidate count. */
    numCandidates: Schema.Number
  }),
  Schema.TaggedStruct("DemoCandidate", {
    /** Zero-based predictor position in the module tree. */
    predictorIndex: Schema.Number,
    /** Zero-based candidate position for that predictor. */
    candidateIndex: Schema.Number
  }),
  Schema.TaggedStruct("Phase1Completed", {
    /** Number of demonstration candidates materialized across predictors. */
    totalCandidates: Schema.Number
  }),
  Schema.TaggedStruct("Phase2Started", {
    /** Caller-supplied instruction candidate count. */
    numInstructions: Schema.Number
  }),
  Schema.TaggedStruct("InstructionProposed", {
    /** Zero-based predictor position in the module tree. */
    predictorIndex: Schema.Number,
    /** Model-generated instruction; may contain sensitive output. */
    instruction: Schema.String
  }),
  Schema.TaggedStruct("Phase2Completed", {
    /** Number of instruction candidates materialized across predictors. */
    totalInstructions: Schema.Number
  }),
  Schema.TaggedStruct("Phase3Started", {
    /** Normalized Phase 3 trial budget. */
    numTrials: Schema.Number
  }),
  Schema.TaggedStruct("TrialEvaluated", {
    /** Zero-based Phase 3 trial position. */
    trial: Schema.Number,
    /** Mean metric score on the trial's minibatch. */
    score: Schema.Number
  }),
  Schema.TaggedStruct("FullEvalCompleted", {
    /** Highest full-validation score observed through this checkpoint. */
    bestScore: Schema.Number
  }),
  Schema.TaggedStruct("Phase3Completed", {
    /** Highest full-validation score retained by Phase 3. */
    bestScore: Schema.Number,
    /** Number of Phase 3 trials actually evaluated. */
    totalTrials: Schema.Number
  })
)

/**
 * Unites MIPROv2 phase, candidate-generation, evaluation, and completion records.
 *
 * @since 0.1.0
 * @category events
 */
export type MIPROv2Event = typeof MIPROv2EventSchema.Type

/**
 * Constructs and exhaustively matches lifecycle events by `_tag`.
 *
 * @since 0.1.0
 * @category events
 */
export const MIPROv2Event = Data.taggedEnum<MIPROv2Event>()
