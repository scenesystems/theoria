/**
 * Optimizer-domain errors.
 *
 * @since 0.0.0
 */
import { Schema } from "effect"

/**
 * BootstrapFewShot produced zero high-scoring demos after all rounds.
 *
 * @since 0.0.0
 * @category errors
 * @see BootstrapFewShot
 */
export class BootstrapFailed extends Schema.TaggedError<BootstrapFailed>()(
  "BootstrapFailed",
  {
    message: Schema.String,
    roundsAttempted: Schema.Number,
    totalTraces: Schema.Number,
    threshold: Schema.optionalWith(Schema.Number, {
      default: () => 0
    }),
    acceptedTraces: Schema.optionalWith(Schema.Number, {
      default: () => 0
    }),
    rejectedTraces: Schema.optionalWith(Schema.Number, {
      default: () => 0
    }),
    evaluatedExamples: Schema.optionalWith(Schema.Number, {
      default: () => 0
    }),
    bestScoreSeen: Schema.optionalWith(Schema.Boolean, {
      default: () => false
    }),
    bestScore: Schema.optionalWith(Schema.Number, {
      default: () => 0
    }),
    averageScore: Schema.optionalWith(Schema.Number, {
      default: () => 0
    })
  }
) {}

/**
 * MIPROv2 Phase 2 meta-LLM failed to produce a valid instruction.
 *
 * @since 0.0.0
 * @category errors
 * @see MIPROv2
 */
export class InstructionProposalFailed extends Schema.TaggedError<InstructionProposalFailed>()(
  "InstructionProposalFailed",
  {
    message: Schema.String,
    predictorIndex: Schema.Number
  }
) {}

/**
 * Every trial evaluation in an optimizer run errored.
 *
 * @since 0.0.0
 * @category errors
 */
export class AllTrialsFailed extends Schema.TaggedError<AllTrialsFailed>()(
  "AllTrialsFailed",
  {
    message: Schema.String,
    trialCount: Schema.Number
  }
) {}

/**
 * GEPA merge/crossover was rejected by the acceptance gate.
 *
 * @since 0.0.0
 * @category errors
 * @see GEPA
 */
export class MergeRejected extends Schema.TaggedError<MergeRejected>()(
  "MergeRejected",
  {
    message: Schema.String,
    parentA: Schema.String,
    parentB: Schema.String
  }
) {}
