/**
 * Evaluation event contracts.
 *
 * @since 0.1.0
 */
import { Data, Schema } from "effect"
import { ExampleFailure } from "./report.js"

/**
 * Schema for per-example start and terminal events plus the final aggregate
 * completion event.
 *
 * @since 0.1.0
 * @category events
 */
export const EvaluationEventSchema = Schema.Union(
  Schema.TaggedStruct("ExampleStarted", {
    index: Schema.Number,
    total: Schema.Number
  }),
  Schema.TaggedStruct("ExampleCompleted", {
    index: Schema.Number,
    score: Schema.Number
  }),
  Schema.TaggedStruct("ExampleFailed", {
    failure: ExampleFailure
  }),
  Schema.TaggedStruct("EvaluationCompleted", {
    overallScore: Schema.Number,
    total: Schema.Number
  })
)

/**
 * Progress values emitted while evaluating examples: each start is followed
 * by either completion or failure, and the run ends with one aggregate
 * `EvaluationCompleted` value.
 *
 * @since 0.1.0
 * @category events
 */
export type EvaluationEventType = typeof EvaluationEventSchema.Type

/**
 * Builds, narrows, and exhaustively matches evaluation progress values by
 * their `_tag`, so consumers share the schema's closed event set.
 *
 * @since 0.1.0
 * @category events
 */
export const EvaluationEvent = Data.taggedEnum<EvaluationEventType>()
