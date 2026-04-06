/**
 * COPRO optimizer event contracts.
 *
 * @since 0.2.0
 * @category events
 */
import { Data, Schema } from "effect"

/**
 * Schema describing events emitted during COPRO optimization.
 *
 * @since 0.2.0
 * @category events
 */
export const COPROEventSchema = Schema.Union(
  Schema.TaggedStruct("OptimizationStarted", {
    maxSteps: Schema.Number,
    numCandidates: Schema.Number,
    resumedFromSnapshot: Schema.Boolean,
    nextStep: Schema.Number
  }),
  Schema.TaggedStruct("StepStarted", {
    step: Schema.Number
  }),
  Schema.TaggedStruct("InstructionCandidateProposed", {
    step: Schema.Number,
    predictorName: Schema.String,
    candidateIndex: Schema.Number,
    instruction: Schema.String
  }),
  Schema.TaggedStruct("TrialEvaluated", {
    step: Schema.Number,
    predictorName: Schema.String,
    trialNumber: Schema.Number,
    candidateIndex: Schema.Number,
    score: Schema.Number,
    improved: Schema.Boolean
  }),
  Schema.TaggedStruct("PredictorUpdated", {
    step: Schema.Number,
    predictorName: Schema.String,
    instruction: Schema.String,
    score: Schema.Number,
    changed: Schema.Boolean
  }),
  Schema.TaggedStruct("StepCompleted", {
    step: Schema.Number,
    bestScore: Schema.Number,
    changedPredictorCount: Schema.Number
  }),
  Schema.TaggedStruct("OptimizationCompleted", {
    stepsCompleted: Schema.Number,
    totalTrials: Schema.Number,
    bestScore: Schema.Number
  })
)

/**
 * Events emitted during COPRO optimization.
 *
 * @since 0.2.0
 * @category events
 */
export type COPROEvent = typeof COPROEventSchema.Type

/**
 * Constructors and match helpers for COPRO events.
 *
 * @since 0.2.0
 * @category events
 */
export const COPROEvent = Data.taggedEnum<COPROEvent>()
