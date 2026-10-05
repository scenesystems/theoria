/** Metric constructors. @since 0.1.0 */
import { Effect, Option, Record, Schema } from "effect"
import { type Fn, Metric, Score } from "../../Metric.js"

/** Wraps a synchronous raw-label/output scorer. Missing labels become an empty
 * record; non-record outputs become an empty record. Exceptions remain defects.
 * @since 1.0.0
 * @category constructors
 */
export const fromSync = (
  score: (labels: Record.ReadonlyRecord<string, unknown>, output: Record.ReadonlyRecord<string, unknown>) => number,
  name = "fromSync"
): Metric =>
  new Metric({
    name,
    score: (example, prediction) =>
      Effect.sync(() =>
        new Score({
          value: score(
            Option.getOrElse(example.labels, Record.empty),
            Option.getOrElse(
              Schema.decodeUnknownOption(Schema.Record(Schema.String, Schema.Unknown))(prediction.output),
              Record.empty
            )
          ),
          feedback: Option.none()
        })
      )
  })

/** Retains an example-aware scorer's failures, requirements and feedback.
 * @since 1.0.0
 * @category constructors
 */
export const withFeedback = <E, R>(score: Fn<E, R>, name = "withFeedback"): Metric<E, R> => new Metric({ name, score })
