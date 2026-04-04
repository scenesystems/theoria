/**
 * BootstrapFewShot optimizer event contracts.
 *
 * @since 0.1.0
 */
import { Data, Schema } from "effect"

/**
 * Schema describing events emitted during BootstrapFewShot optimization.
 *
 * @since 0.1.0
 * @category events
 * @see {@link BootstrapEvent}
 */
export const BootstrapEventSchema = Schema.Union(
  Schema.TaggedStruct("RoundStarted", {
    round: Schema.Number,
    maxRounds: Schema.Number
  }),
  Schema.TaggedStruct("TraceAccepted", {
    moduleName: Schema.String,
    score: Schema.Number
  }),
  Schema.TaggedStruct("TraceRejected", {
    moduleName: Schema.String,
    score: Schema.Number,
    threshold: Schema.Number
  }),
  Schema.TaggedStruct("RoundCompleted", {
    round: Schema.Number,
    demosCollected: Schema.Number
  }),
  Schema.TaggedStruct("BootstrapFallbackActivated", {
    threshold: Schema.Number,
    roundsAttempted: Schema.Number,
    acceptedTraces: Schema.Number,
    rejectedTraces: Schema.Number,
    bestScoreSeen: Schema.Boolean,
    bestScore: Schema.Number,
    averageScore: Schema.Number,
    fallbackLabeledDemoCount: Schema.Number
  }),
  Schema.TaggedStruct("BootstrapFallbackCompleted", {
    fallbackDemosAdded: Schema.Number,
    totalDemos: Schema.Number,
    roundsUsed: Schema.Number
  }),
  Schema.TaggedStruct("BootstrapCompleted", {
    totalDemos: Schema.Number,
    roundsUsed: Schema.Number,
    fallbackUsed: Schema.Boolean
  })
)

/**
 * Events emitted during BootstrapFewShot optimization.
 *
 * @since 0.1.0
 * @category events
 */
export type BootstrapEvent = typeof BootstrapEventSchema.Type

/**
 * Constructors and match helpers for BootstrapFewShot events.
 *
 * @since 0.1.0
 * @category events
 */
export const BootstrapEvent = Data.taggedEnum<BootstrapEvent>()
