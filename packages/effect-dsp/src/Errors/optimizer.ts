/**
 * Optimizer-domain errors.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * BootstrapFewShot exhausted its rounds without enough acceptable traces.
 * The counters describe the completed run and the optional-defaulted score
 * fields keep older serialized failures decodable; inspect `bestScoreSeen`
 * before treating `bestScore` as an observed value.
 *
 * @since 0.1.0
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
 * MIPROv2's proposal phase could not decode a valid instruction for the
 * zero-based `predictorIndex`. This is distinct from a candidate trial whose
 * metric evaluation failed.
 *
 * @since 0.1.0
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
 * No optimizer trial produced a score, so there is no candidate that can be
 * selected as the result. `trialCount` is the number of attempted trials, not
 * the configured budget when a run stopped early.
 *
 * @since 0.1.0
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
 * GEPA produced a crossover candidate but its acceptance gate rejected the
 * merge. `parentA` and `parentB` are stable candidate identities that callers
 * can correlate with optimizer events; rejection is an expected search
 * outcome rather than a language-model transport failure.
 *
 * @since 0.1.0
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
