/**
 * Shared metric scoring helpers for `Evaluate` and direct optimizer loops.
 *
 * @since 0.2.0
 * @category internal
 * @internal
 */
import { Array as Arr, Data, Effect, Either, Option, Order, Record, Schema } from "effect"

import { MetricPayload } from "../../contracts/MetricFn.js"
import { EvaluationFailed } from "../../Errors/metric.js"
import type { Example as ExampleModel } from "../../Example/index.js"
import { MetricContext } from "../../Metric/context.js"
import type { Metric } from "../../Metric/model.js"
import { averageNumbers } from "../../Metric/score.js"
import type { Module } from "../../Module/model.js"

/**
 * @since 0.2.0
 * @internal
 */
export type MetricEntry<ME, MR> = readonly [string, Metric<ME, MR>]

type ExampleScore = Readonly<Record<string, number>>

const emptyPayload: typeof MetricPayload.Type = {}
const metricEntryOrder: Order.Order<MetricEntry<unknown, unknown>> = Order.mapInput(Order.string, ([name]) => name)

/**
 * @since 0.2.0
 * @internal
 */
export const sortedMetricEntries = <ME, MR>(metrics: Readonly<Record<string, Metric<ME, MR>>>) =>
  Arr.sort(Record.toEntries(metrics), metricEntryOrder)

/**
 * @since 0.2.0
 * @internal
 */
export const resolveConcurrency = (options: { readonly concurrency?: number }): number =>
  Option.getOrElse(Option.fromNullable(options.concurrency), () => 1)

const scoreMap = (scores: ReadonlyArray<readonly [string, number]>): ExampleScore =>
  Arr.reduce(
    scores,
    Record.empty<string, number>(),
    (current, [metricName, score]) => Record.set(current, metricName, score)
  )

const evaluateMissingOutput = (index: number) =>
  Effect.fail(
    new EvaluationFailed({
      index,
      message: "Missing expected output for evaluation example"
    })
  )

const decodeMetricPayload = (options: {
  readonly index: number
  readonly role: "prediction" | "expected"
  readonly payload: unknown
}) =>
  Schema.decodeUnknown(MetricPayload)(options.payload).pipe(
    Effect.mapError(
      () =>
        new EvaluationFailed({
          index: options.index,
          message: `${options.role} payload must satisfy MetricPayload`
        })
    )
  )

const decodeMetricPayloadOrEmpty = (payload: unknown) =>
  Schema.decodeUnknown(MetricPayload)(payload).pipe(
    Effect.either,
    Effect.map((result) => Either.getOrElse(result, () => emptyPayload))
  )

const decodeModuleInput = <I extends Schema.Struct.Fields>(options: {
  readonly index: number
  readonly schema: Schema.Struct<I>
  readonly payload: unknown
}) =>
  Schema.decodeUnknown(options.schema)(options.payload).pipe(
    Effect.mapError(
      () =>
        new EvaluationFailed({
          index: options.index,
          message: "example input does not match module input schema"
        })
    )
  )

/**
 * @since 0.2.0
 * @internal
 */
export const scoreExample = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME,
  MR
>(options: {
  readonly index: number
  readonly example: ExampleModel
  readonly module: Module<I, O>
  readonly metrics: ReadonlyArray<MetricEntry<ME, MR>>
}) =>
  Effect.gen(function*() {
    const decodedInput = yield* decodeModuleInput({
      index: options.index,
      schema: options.module.signature.inputSchema,
      payload: options.example.input
    })
    const inputPayload = yield* decodeMetricPayloadOrEmpty(options.example.input)
    const expected = yield* Option.match(Option.fromNullable(options.example.output), {
      onNone: () => evaluateMissingOutput(options.index),
      onSome: (value) => Effect.succeed(value)
    })
    const prediction = yield* options.module.forward(decodedInput)
    const expectedPayload = yield* decodeMetricPayload({
      index: options.index,
      role: "expected",
      payload: expected
    })
    const predictionPayload = yield* decodeMetricPayload({
      index: options.index,
      role: "prediction",
      payload: prediction
    })
    const context = Option.fromNullable(options.example.metadata).pipe(
      Option.match({
        onNone: () =>
          MetricContext.of({
            input: inputPayload,
            prediction: predictionPayload,
            expected: expectedPayload
          }),
        onSome: (metadata) =>
          MetricContext.of({
            input: inputPayload,
            prediction: predictionPayload,
            expected: expectedPayload,
            metadata
          })
      })
    )
    const scores = yield* Effect.forEach(options.metrics, ([metricName, metric]) =>
      metric.scoreContext(context).pipe(
        Effect.map((result) => Data.tuple(metricName, result.score))
      ))

    return {
      scores: scoreMap(scores),
      averageScore: averageNumbers(Arr.map(scores, ([, score]) => score))
    }
  })
