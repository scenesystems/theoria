/**
 * Serializable terminal failures from DSP optimization algorithms.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Reports that BootstrapFewShot could not produce an acceptable demonstration set.
 *
 * @remarks
 * The fields capture optimizer state at the failure point. Optional-defaulted
 * fields keep older encoded values decodable; `bestScore` is meaningful only
 * when `bestScoreSeen` is true. Numeric fields are not range-checked by the schema.
 *
 * @since 0.1.0
 * @category errors
 */
export class BootstrapFailed extends Schema.TaggedError<BootstrapFailed>()(
  "BootstrapFailed",
  {
    /** Diagnostic text for the terminal condition. */
    message: Schema.String,
    /** Rounds completed or entered before failure. */
    roundsAttempted: Schema.Number,
    /** Traces collected before threshold filtering. */
    totalTraces: Schema.Number,
    /** Acceptance threshold active for the run; defaults to `0` when decoded from older values. */
    threshold: Schema.optionalWith(Schema.Number, {
      default: () => 0
    }),
    /** Traces accepted into the candidate demonstration set; defaults to `0`. */
    acceptedTraces: Schema.optionalWith(Schema.Number, {
      default: () => 0
    }),
    /** Traces rejected by the acceptance threshold; defaults to `0`. */
    rejectedTraces: Schema.optionalWith(Schema.Number, {
      default: () => 0
    }),
    /** Examples evaluated while collecting traces; defaults to `0`. */
    evaluatedExamples: Schema.optionalWith(Schema.Number, {
      default: () => 0
    }),
    /** Whether any evaluation produced a score; defaults to `false`. */
    bestScoreSeen: Schema.optionalWith(Schema.Boolean, {
      default: () => false
    }),
    /** Highest observed score when `bestScoreSeen` is true; otherwise the default `0`. */
    bestScore: Schema.optionalWith(Schema.Number, {
      default: () => 0
    }),
    /** Mean of observed scores, or the default `0` when none were recorded. */
    averageScore: Schema.optionalWith(Schema.Number, {
      default: () => 0
    })
  }
) {}

/**
 * Reports that MIPROv2 could not produce a usable instruction proposal.
 *
 * @remarks
 * The predictor index identifies the target within proposal order. Candidate
 * evaluation failures use a different error path after proposals are decoded.
 *
 * @since 0.1.0
 * @category errors
 */
export class InstructionProposalFailed extends Schema.TaggedError<InstructionProposalFailed>()(
  "InstructionProposalFailed",
  {
    /** Diagnostic text from proposal generation or decoding. */
    message: Schema.String,
    /** Zero-based target position in proposal order. */
    predictorIndex: Schema.Number
  }
) {}

/**
 * Reports that an optimizer cannot construct or select a candidate.
 *
 * @remarks
 * Conditions include empty candidate sets, invalid candidate projections, and
 * searches with no selectable result. `trialCount` may hold an attempted-trial
 * count, configured budget, or offending candidate count; `message` identifies
 * which meaning applies.
 *
 * @since 0.1.0
 * @category errors
 */
export class AllTrialsFailed extends Schema.TaggedError<AllTrialsFailed>()(
  "AllTrialsFailed",
  {
    /** Diagnostic text identifying the failed search or candidate invariant. */
    message: Schema.String,
    /** Count associated with the failure condition, as described by `message`. */
    trialCount: Schema.Number
  }
) {}

/**
 * Reports that GEPA declined to add a crossover candidate to its population.
 *
 * @remarks
 * Parent identifiers allow an integration to correlate the diagnostic with
 * optimizer events or persisted candidate records.
 *
 * @since 0.1.0
 * @category errors
 */
export class MergeRejected extends Schema.TaggedError<MergeRejected>()(
  "MergeRejected",
  {
    /** Diagnostic text explaining the rejection. */
    message: Schema.String,
    /** Stable identifier of the first parent candidate. */
    parentA: Schema.String,
    /** Stable identifier of the second parent candidate. */
    parentB: Schema.String
  }
) {}
