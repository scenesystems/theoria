/**
 * Shared evaluation runtime kernel used by both `Evaluate.run` and `Evaluate.stream`.
 *
 * @since 0.1.0
 */
import * as Evaluation from "@scenesystems/effect-study/Evaluation"
import { Array as Arr, Effect, Match, Option } from "effect"
import type { Schema } from "effect"
import { events, Failed, type Options, type Outcome, Scored, TooManyErrors } from "../../Evaluate.js"
import { maxFailures } from "../maxErrors.js"
import { aggregateOutcomes } from "./aggregate.js"
import { evaluateExample, EvaluateExampleOptions, type EvaluationEventSink, sortedMetricEntries } from "./example.js"

export { type EvaluationEventSink } from "./example.js"

/**
 * Runs the evaluation kernel and sends lifecycle events to a sink.
 *
 * @since 0.1.0
 * @category combinators
 */
export const evaluateKernel = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never,
  E = never,
  R = never
>(
  options: Options<I, O, ME, MR, E, R>,
  emit: EvaluationEventSink
) =>
  Effect.gen(function*() {
    const total = Arr.length(options.examples)
    const metrics = sortedMetricEntries(options.metrics)
    const trials = yield* Evaluation.runCollecting(
      options.examples,
      (example, index) =>
        evaluateExample(
          new EvaluateExampleOptions({
            index,
            total,
            example,
            module: options.module,
            metrics,
            emit
          })
        ),
      {
        concurrency: Option.getOrElse(Option.fromNullishOr(options.concurrency), () => 1),
        maxFailures: maxFailures(Option.flatten(Option.fromUndefinedOr(options.maxErrors))),
        onFailure: "record"
      }
    ).pipe(Effect.mapError((error) =>
      new TooManyErrors({
        count: error.count,
        limit: Option.getOrElse(Option.flatten(Option.fromUndefinedOr(options.maxErrors)), () => error.limit + 1)
      })
    ))
    const outcomes = Arr.map(Arr.fromIterable(trials), (trial): Outcome =>
      Match.valueTags(trial.state, {
        Completed: (state) =>
          new Scored({
            index: trial.trialNumber,
            example: trial.config,
            durationMs: state.duration,
            ...state.value
          }),
        Failed: (state) =>
          new Failed({
            index: trial.trialNumber,
            example: trial.config,
            durationMs: state.duration,
            failure: state.error
          })
      }))
    const report = aggregateOutcomes(
      Arr.map(metrics, ([name]) => name),
      outcomes,
      Option.getOrElse(Option.fromUndefinedOr(options.failureScore), () => 0)
    )

    yield* emit(
      events.EvaluationCompleted({
        overallScore: report.average,
        total
      })
    )

    return report
  })

/**
 * Event sink that discards every event.
 *
 * @since 0.1.0
 * @category constants
 */
export const noEvents: EvaluationEventSink = () => Effect.void
