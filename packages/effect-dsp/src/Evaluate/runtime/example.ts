/**
 * Per-example evaluation runtime.
 *
 * @since 0.0.0
 * @category internal
 * @internal
 */
import { Array as Arr, Clock, Data, Effect, Match, Option, Order, Predicate, Record, Schema } from "effect"
import { MetricPayload } from "../../contracts/MetricFn.js"
import { EvaluationFailed } from "../../Errors/metric.js"
import type { Example as ExampleModel } from "../../Example/index.js"
import type { Metric } from "../../Metric/model.js"
import { averageNumbers } from "../../Metric/score.js"
import type { Module } from "../../Module/model.js"
import { EvaluationEvent } from "../events.js"
import type { EvaluationEventType } from "../events.js"
import { ExampleFailure, ExampleResult } from "../report.js"

/**
 * @since 0.0.0
 * @internal
 */
export type EvaluationEventSink = (event: EvaluationEventType) => Effect.Effect<void>

/**
 * @since 0.0.0
 * @internal
 */
export type MetricEntry<ME, MR> = readonly [string, Metric<ME, MR>]

/**
 * @since 0.0.0
 * @internal
 */
export type ExampleOutcome = Readonly<{
  readonly result: ExampleResult
  readonly success: boolean
  readonly averageScore: number
  readonly failure: Option.Option<ExampleFailure>
}>

type ExampleScore = Readonly<Record<string, number>>

const metricEntryOrder: Order.Order<MetricEntry<unknown, unknown>> = Order.mapInput(Order.string, ([name]) => name)

/**
 * @since 0.0.0
 * @internal
 */
export const sortedMetricEntries = <ME, MR>(metrics: Readonly<Record<string, Metric<ME, MR>>>) =>
  Arr.sort(Record.toEntries(metrics), metricEntryOrder)

const hasMessageProperty = (value: unknown): value is { readonly message: unknown } =>
  Predicate.hasProperty(value, "message")

const hasTagProperty = (value: unknown): value is { readonly _tag: unknown } => Predicate.hasProperty(value, "_tag")

const failureMessageFromUnknown = (error: unknown): string =>
  Match.value(error).pipe(
    Match.when(Predicate.isString, (message) => message),
    Match.when(hasMessageProperty, (value) =>
      Match.value(value.message).pipe(
        Match.when(Predicate.isString, (message) => message),
        Match.orElse(() => "Unknown evaluation error")
      )),
    Match.orElse(() => "Unknown evaluation error")
  )

const failureTagFromUnknown = (error: unknown): string =>
  Match.value(error).pipe(
    Match.when(
      hasTagProperty,
      (value) =>
        Match.value(value._tag).pipe(
          Match.when(Predicate.isString, (tag) => tag),
          Match.orElse(() => "UnknownEvaluationError")
        )
    ),
    Match.orElse(() => "UnknownEvaluationError")
  )

const exampleFailureFromUnknown = (index: number, error: unknown): ExampleFailure =>
  new ExampleFailure({
    index,
    tag: failureTagFromUnknown(error),
    message: failureMessageFromUnknown(error)
  })

/**
 * @since 0.0.0
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

const scoreExample = <
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
    const scores = yield* Effect.forEach(options.metrics, ([metricName, metric]) =>
      metric.score(predictionPayload, expectedPayload).pipe(
        Effect.map((result) =>
          Data.tuple(metricName, result.score)
        )
      ))

    return {
      scores: scoreMap(scores),
      averageScore: averageNumbers(Arr.map(scores, ([, score]) => score))
    }
  })

/**
 * @since 0.0.0
 * @internal
 */
export const evaluateOutcome = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME,
  MR
>(options: {
  readonly index: number
  readonly total: number
  readonly example: ExampleModel
  readonly module: Module<I, O>
  readonly metrics: ReadonlyArray<MetricEntry<ME, MR>>
  readonly emit: EvaluationEventSink
}) =>
  Effect.gen(function*() {
    yield* options.emit(
      EvaluationEvent.ExampleStarted({
        index: options.index,
        total: options.total
      })
    )

    const startedAt = yield* Clock.currentTimeMillis

    return yield* scoreExample(options).pipe(
      Effect.matchEffect({
        onFailure: (error) =>
          Effect.gen(function*() {
            const completedAt = yield* Clock.currentTimeMillis
            const failure = exampleFailureFromUnknown(options.index, error)

            yield* options.emit(
              EvaluationEvent.ExampleFailed({
                failure
              })
            )

            return {
              result: new ExampleResult({
                index: options.index,
                scores: {},
                failure: Option.some(failure),
                durationMs: completedAt - startedAt
              }),
              success: false,
              averageScore: 0,
              failure: Option.some(failure)
            }
          }),
        onSuccess: ({ scores, averageScore }) =>
          Effect.gen(function*() {
            const completedAt = yield* Clock.currentTimeMillis

            yield* options.emit(
              EvaluationEvent.ExampleCompleted({
                index: options.index,
                score: averageScore
              })
            )

            return {
              result: new ExampleResult({
                index: options.index,
                scores,
                failure: Option.none(),
                durationMs: completedAt - startedAt
              }),
              success: true,
              averageScore,
              failure: Option.none<ExampleFailure>()
            }
          })
      })
    )
  })
