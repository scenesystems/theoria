/**
 * Evaluation event contracts.
 *
 * @since 0.0.0
 */
import { Data, Schema } from "effect"
import { ExampleFailure } from "./report.js"

/**
 * Schema union describing lifecycle events emitted during evaluation:
 * `ExampleStarted`, `ExampleCompleted`, `ExampleFailed`, and
 * `EvaluationCompleted`.
 *
 * @since 0.0.0
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
 * Discriminated union of evaluation lifecycle events, extracted from
 * {@link EvaluationEventSchema}.
 *
 * @since 0.0.0
 * @category events
 */
export type EvaluationEventType = typeof EvaluationEventSchema.Type

/**
 * Tagged-enum constructors and `$match` helpers for evaluation events.
 *
 * @since 0.0.0
 * @category events
 */
export const EvaluationEvent = Data.taggedEnum<EvaluationEventType>()
