/**
 * Defines the closed lifecycle event protocol emitted by BootstrapFewShot.
 *
 * @since 0.1.0
 */
import { Data, Schema } from "effect"

/**
 * Decodes round progress, trace decisions, labeled fallback, and completion events.
 *
 * @remarks
 * Trace events carry metric scores at the point of acceptance or rejection.
 * Fallback summaries distinguish the absence of any observed score with
 * `bestScoreSeen`; consumers must not interpret `bestScore: 0` on its own.
 *
 * @since 0.1.0
 * @category events
 * @see {@link BootstrapEvent}
 */
export const BootstrapEventSchema = Schema.Union(
  Schema.TaggedStruct("RoundStarted", {
    /** One-based round entering execution. */
    round: Schema.Number,
    /** Normalized upper bound on bootstrap rounds. */
    maxRounds: Schema.Number
  }),
  Schema.TaggedStruct("TraceAccepted", {
    /** Module whose traced prediction supplied the demonstration. */
    moduleName: Schema.String,
    /** Metric score compared with the acceptance threshold. */
    score: Schema.Number
  }),
  Schema.TaggedStruct("TraceRejected", {
    /** Module whose trace was rejected or could not supply a demonstration. */
    moduleName: Schema.String,
    /** Metric score assigned to the rejected trace. */
    score: Schema.Number,
    /** Inclusive minimum score configured for acceptance. */
    threshold: Schema.Number
  }),
  Schema.TaggedStruct("RoundCompleted", {
    /** One-based round that completed. */
    round: Schema.Number,
    /** Total demonstrations retained after merging this round. */
    demosCollected: Schema.Number
  }),
  Schema.TaggedStruct("BootstrapFallbackActivated", {
    /** Acceptance threshold used by the completed bootstrap rounds. */
    threshold: Schema.Number,
    /** Number of rounds executed before fallback. */
    roundsAttempted: Schema.Number,
    /** Traces accepted across all attempted rounds. */
    acceptedTraces: Schema.Number,
    /** Traces rejected across all attempted rounds. */
    rejectedTraces: Schema.Number,
    /** Whether any attempted trace produced a metric score. */
    bestScoreSeen: Schema.Boolean,
    /** Highest observed score, or zero when `bestScoreSeen` is false. */
    bestScore: Schema.Number,
    /** Mean score across evaluated examples, or zero when none were evaluated. */
    averageScore: Schema.Number,
    /** Maximum labeled demonstrations requested from fallback. */
    fallbackLabeledDemoCount: Schema.Number
  }),
  Schema.TaggedStruct("BootstrapFallbackCompleted", {
    /** Demonstrations present after labeled fallback. */
    fallbackDemosAdded: Schema.Number,
    /** Demonstrations retained by the optimized module. */
    totalDemos: Schema.Number,
    /** Bootstrap rounds executed before fallback. */
    roundsUsed: Schema.Number
  }),
  Schema.TaggedStruct("BootstrapCompleted", {
    /** Demonstrations retained by the optimized module. */
    totalDemos: Schema.Number,
    /** Bootstrap rounds executed before completion. */
    roundsUsed: Schema.Number,
    /** Whether labeled fallback produced the final demonstrations. */
    fallbackUsed: Schema.Boolean
  })
)

/**
 * Unites BootstrapFewShot round, trace-selection, fallback, and completion records.
 *
 * @since 0.1.0
 * @category events
 */
export type BootstrapEvent = typeof BootstrapEventSchema.Type

/**
 * Constructs and exhaustively matches lifecycle events by `_tag`.
 *
 * @since 0.1.0
 * @category events
 */
export const BootstrapEvent = Data.taggedEnum<BootstrapEvent>()
