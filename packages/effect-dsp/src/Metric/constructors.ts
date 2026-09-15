/**
 * Constructors for pure and effectful scoring functions.
 *
 * @since 0.1.0
 */
import { Effect } from "effect"
import type { MetricFn, PureMetricFn } from "../contracts/MetricFn.js"
import { Metric } from "./model.js"

/**
 * Wraps a synchronous scoring function as an infallible metric.
 *
 * @remarks
 * The function runs each time `score` is executed. Synchronous exceptions become
 * Effect defects rather than typed failures.
 *
 * @typeParam A - Decoded output type inferred from the scorer's parameter.
 * @param name - Diagnostic name retained on the metric.
 * @param score - Synchronous scorer for prediction and expected payloads.
 * @returns A metric with no typed error or service requirements.
 *
 * @example
 * ```ts
 * import * as Metric from "@scenesystems/effect-dsp/Metric"
 * import { Boolean, Effect, Equal, Schema } from "effect"
 *
 * const Output = Schema.Struct({ answer: Schema.String })
 * const accuracy = Metric.make("accuracy", (prediction: typeof Output.Type, expected) =>
 *   new Metric.Result({
 *     score: Boolean.match(Equal.equals(prediction.answer, expected.answer), {
 *       onTrue: () => 1,
 *       onFalse: () => 0
 *     })
 *   })
 * )
 *
 * export const program = accuracy.score({ answer: "Paris" }, { answer: "Paris" }).pipe(
 *   Effect.filterOrFail(
 *     (result) => Equal.equals(result.score, 1),
 *     () => "UnexpectedScore"
 *   )
 * )
 * ```
 *
 * @since 0.1.0
 * @category constructors
 */
export const make = <A>(name: string, score: PureMetricFn<A>): Metric<never, never, A> =>
  new Metric({
    name,
    score: (prediction, expected) => Effect.sync(() => score(prediction, expected))
  })

/**
 * Retains an effectful scorer's typed failures and service requirements.
 *
 * @typeParam E - Expected scoring failure.
 * @typeParam R - Services used during scoring.
 * @typeParam A - Decoded output type inferred from the scorer's parameter.
 * @param name - Diagnostic name retained on the metric.
 * @param score - Effectful scorer invoked for each prediction and expected pair.
 * @returns A metric with the scorer's original error and requirement channels.
 *
 * @example
 * ```ts
 * import * as Metric from "@scenesystems/effect-dsp/Metric"
 * import { Boolean, Effect, Equal, Number, Ref, Schema } from "effect"
 *
 * const Output = Schema.Struct({ answer: Schema.String })
 * export const program = Effect.gen(function*() {
 *   const calls = yield* Ref.make(0)
 *   const graded = Metric.fromEffect("graded", (prediction: typeof Output.Type, expected) => Effect.gen(function*() {
 *     yield* Ref.update(calls, Number.increment)
 *     return new Metric.Result({
 *       score: Boolean.match(Equal.equals(prediction.answer, expected.answer), {
 *         onTrue: () => 1,
 *         onFalse: () => 0
 *       })
 *     })
 *   }))
 *
 *   const result = yield* graded.score({ answer: "4" }, { answer: "4" })
 *   const callCount = yield* Ref.get(calls)
 *
 *   return yield* Effect.succeed(result).pipe(
 *     Effect.filterOrFail(
 *       (current) => Boolean.and(Equal.equals(current.score, 1), Equal.equals(callCount, 1)),
 *       () => "UnexpectedMetricResult"
 *     )
 *   )
 * })
 * ```
 *
 * @since 0.1.0
 * @category constructors
 */
export const fromEffect = <E, R, A = unknown>(name: string, score: MetricFn<A, E, R>): Metric<E, R, A> =>
  new Metric({
    name,
    score
  })
