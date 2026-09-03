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
 * @param name - Diagnostic name retained on the metric.
 * @param score - Synchronous scorer for prediction and expected payloads.
 * @returns A metric with no typed error or service requirements.
 *
 * @example
 * ```ts
 * import * as Metric from "@scenesystems/effect-dsp/Metric"
 * import { Effect, Match } from "effect"
 *
 * const accuracy = Metric.make("accuracy", (prediction, expected) =>
 *   new Metric.Result({
 *     score: Match.value(prediction["answer"] === expected["answer"]).pipe(
 *       Match.when(true, () => 1),
 *       Match.orElse(() => 0)
 *     )
 *   })
 * )
 *
 * export const program = accuracy.score({ answer: "Paris" }, { answer: "Paris" }).pipe(
 *   Effect.filterOrFail(
 *     (result) => result.score === 1,
 *     () => "UnexpectedScore"
 *   )
 * )
 * ```
 *
 * @since 0.1.0
 * @category constructors
 */
export const make = (name: string, score: PureMetricFn): Metric =>
  new Metric({
    name,
    score: (prediction, expected) =>
      Effect.succeed(
        score(prediction, expected)
      )
  })

/**
 * Retains an effectful scorer's typed failures and service requirements.
 *
 * @typeParam E - Expected scoring failure.
 * @typeParam R - Services used during scoring.
 * @param name - Diagnostic name retained on the metric.
 * @param score - Effectful scorer invoked for each prediction and expected pair.
 * @returns A metric with the scorer's original error and requirement channels.
 *
 * @example
 * ```ts
 * import * as Metric from "@scenesystems/effect-dsp/Metric"
 * import { Effect, Match, Ref } from "effect"
 *
 * export const program = Effect.gen(function*() {
 *   const calls = yield* Ref.make(0)
 *   const graded = Metric.fromEffect("graded", (prediction, expected) => Effect.gen(function*() {
 *     yield* Ref.update(calls, (count) => count + 1)
 *     return new Metric.Result({
 *       score: Match.value(prediction["answer"] === expected["answer"]).pipe(
 *         Match.when(true, () => 1),
 *         Match.orElse(() => 0)
 *       )
 *     })
 *   }))
 *
 *   const result = yield* graded.score({ answer: "4" }, { answer: "4" })
 *   const callCount = yield* Ref.get(calls)
 *
 *   return yield* Effect.succeed(result).pipe(
 *     Effect.filterOrFail(
 *       (current) => current.score === 1 && callCount === 1,
 *       () => "UnexpectedMetricResult"
 *     )
 *   )
 * })
 * ```
 *
 * @since 0.1.0
 * @category constructors
 */
export const fromEffect = <E, R>(name: string, score: MetricFn<E, R>): Metric<E, R> =>
  new Metric({
    name,
    score
  })
