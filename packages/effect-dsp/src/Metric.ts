/**
 * Example-aware scoring with invocation evidence and explicit phase context.
 * @since 0.1.0
 * @module
 */
import { Data, Schema } from "effect"
import type { Effect, Option } from "effect"
import type { Example } from "./Example.js"
import type { Prediction } from "./Prediction.js"
import * as Predictor from "./Predictor.js"
import * as Trace from "./Trace.js"

/** Scoring phase selected by the algorithm invoking the metric.
 * @since 0.7.0
 * @category schemas
 */
export const Phase = Schema.Literals(["evaluate", "bootstrap", "search", "reflect", "select"])

/** Scoring phase.
 * @since 0.7.0
 * @category type-level
 */
export type Phase = typeof Phase.Type

/** Identifies a predictor execution when scoring local evidence.
 * @since 0.7.0
 * @category models
 */
export class Target extends Schema.Class<Target>("@scenesystems/effect-dsp/Metric/Target")({
  predictorId: Predictor.Path,
  execution: Trace.Execution.Id
}) {}

/** Evidence and purpose supplied to every metric invocation.
 * @since 0.7.0
 * @category models
 */
export class Context extends Data.Class<{
  readonly phase: Phase
  readonly trace: Option.Option<Trace.Program>
  readonly target: Option.Option<Target>
}> {}

/** Finite, unnormalized score and optional evaluator feedback.
 * @since 0.7.0
 * @category models
 */
export class Score extends Schema.Class<Score>("@scenesystems/effect-dsp/Metric/Score")({
  value: Schema.Finite,
  feedback: Schema.Option(Schema.String)
}) {}

/** Effectful scorer; labels retain their dataset representation.
 * @since 0.1.0
 * @category type-level
 */
export type Fn<E = never, R = never> = (
  example: Example,
  prediction: Prediction<unknown>,
  context: Context
) => Effect.Effect<Score, E, R>

/** A named scorer with preserved expected failures and requirements.
 * @since 0.1.0
 * @category models
 */
export class Metric<E = never, R = never> extends Data.TaggedClass("Metric")<{
  readonly name: string
  readonly score: Fn<E, R>
}> {}

export { answerExactMatch, answerPassageMatch, contains, exactMatch, f1 } from "./internal/metric/builtins.js"
export { compose } from "./internal/metric/compose.js"
export { fromSync, withFeedback } from "./internal/metric/constructors.js"
