/**
 * Serializable progress values emitted by streaming evaluation.
 *
 * @since 0.1.0
 */
import { Data, Schema } from "effect"
import { ExampleFailure } from "./report.js"

/**
 * Decodes the closed set of evaluation lifecycle events.
 *
 * @remarks
 * `ExampleStarted` identifies scheduled work. Each example then produces either
 * `ExampleCompleted` with its mean metric score or `ExampleFailed` with a
 * captured failure. `EvaluationCompleted` carries the mean score across
 * successful examples and is emitted last.
 *
 * @since 0.1.0
 * @category events
 */
export const EvaluationEventSchema = Schema.Union(
  Schema.TaggedStruct("ExampleStarted", {
    /** Zero-based position in the input example array. */
    index: Schema.Number,
    /** Number of examples scheduled by this evaluation. */
    total: Schema.Number
  }),
  Schema.TaggedStruct("ExampleCompleted", {
    /** Zero-based position of the successful example. */
    index: Schema.Number,
    /** Mean of that example's metric scores. */
    score: Schema.Number
  }),
  Schema.TaggedStruct("ExampleFailed", {
    /** Captured schema, module, or metric failure for the example. */
    failure: ExampleFailure
  }),
  Schema.TaggedStruct("EvaluationCompleted", {
    /** Mean score across successful examples; zero when none succeeded. */
    overallScore: Schema.Number,
    /** Number of examples scheduled by the completed evaluation. */
    total: Schema.Number
  })
)

/**
 * Unites the lifecycle records emitted while labeled examples are evaluated.
 *
 * @since 0.1.0
 * @category events
 */
export type EvaluationEventType = typeof EvaluationEventSchema.Type

/**
 * Constructs and exhaustively matches evaluation events by `_tag`.
 *
 * @since 0.1.0
 * @category events
 */
export const EvaluationEvent = Data.taggedEnum<EvaluationEventType>()
