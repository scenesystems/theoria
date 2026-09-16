/**
 * Per-example evaluation runtime.
 *
 * @since 0.1.0
 * @category internal
 * @internal
 */
import {
  Array as Arr,
  Clock,
  Data,
  Effect,
  Match,
  Number,
  Option,
  Order,
  Predicate,
  Record,
  Schema,
  Tuple
} from "effect"
import { EvaluationFailed } from "../../Errors/metric.js"
import type { Example as ExampleModel } from "../../Example/index.js"
import type { Metric } from "../../Metric/model.js"
import { averageNumbers } from "../../Metric/score.js"
import type { Module } from "../../Module/model.js"
import { EvaluationEvent } from "../events.js"
import type { EvaluationEventType } from "../events.js"
import { ExampleFailure, ExampleResult } from "../report.js"

/**
 * @since 0.1.0
 * @internal
 */
export type EvaluationEventSink = (event: EvaluationEventType) => Effect.Effect<void>

/**
 * @since 0.1.0
 * @internal
 */
export type MetricEntry<ME, MR, A> = Schema.Tuple2<typeof Schema.String, Schema.Schema<Metric<ME, MR, A>>>["Type"]

/**
 * @since 0.1.0
 * @internal
 */
export class ExampleOutcome extends Data.Class<{
  readonly result: ExampleResult
  readonly success: boolean
  readonly averageScore: number
  readonly failure: Option.Option<ExampleFailure>
}> {}

type ExampleScore = ExampleResult["scores"]

const metricEntryOrder = <ME, MR, A>(): Order.Order<MetricEntry<ME, MR, A>> =>
  Order.mapInput(Order.string, (entry: MetricEntry<ME, MR, A>) => Tuple.getFirst(entry))

/**
 * @since 0.1.0
 * @internal
 */
export const sortedMetricEntries = <ME, MR, A>(metrics: Record.ReadonlyRecord<string, Metric<ME, MR, A>>) =>
  Arr.sort(Record.toEntries(metrics), metricEntryOrder<ME, MR, A>())

const failureMessageFromUnknown = (error: unknown): string =>
  Match.value(error).pipe(
    Match.when(Predicate.isString, (message) => message),
    Match.when(Schema.is(Schema.Struct({ message: Schema.String })), (value) => value.message),
    Match.orElse(() => "Unknown evaluation error")
  )

const failureTagFromUnknown = (error: unknown): string =>
  Match.value(error).pipe(
    Match.when(Schema.is(Schema.Struct({ _tag: Schema.String })), (value) => value._tag),
    Match.orElse(() => "UnknownEvaluationError")
  )

const exampleFailureFromUnknown = (index: number, error: unknown): ExampleFailure =>
  new ExampleFailure({
    index,
    tag: failureTagFromUnknown(error),
    message: failureMessageFromUnknown(error)
  })

const evaluateMissingOutput = (index: number) =>
  Effect.fail(
    new EvaluationFailed({
      index,
      message: "Missing expected output for evaluation example"
    })
  )

/** @internal */
export class EvaluateExampleOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME,
  MR,
  E,
  R
> extends Data.Class<{
  readonly index: number
  readonly total: number
  readonly example: ExampleModel
  readonly module: Module<I, O, E, R>
  readonly metrics: Iterable<MetricEntry<ME, MR, Schema.Schema.Type<Schema.Struct<O>>>>
  readonly emit: EvaluationEventSink
}> {}

const scoreExample = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME, MR, E, R>(
  options: EvaluateExampleOptions<I, O, ME, MR, E, R>
) =>
  Effect.gen(function*() {
    const decodedInput = yield* Schema.decodeUnknown(options.module.signature.inputSchema)(options.example.input).pipe(
      Effect.mapError(() =>
        new EvaluationFailed({
          index: options.index,
          message: "example input does not match module input schema"
        })
      )
    )
    const expected = yield* Option.match(Option.fromNullable(options.example.output), {
      onNone: () => evaluateMissingOutput(options.index),
      onSome: (value) => Effect.succeed(value)
    })
    const prediction = yield* options.module.forward(decodedInput)
    const expectedOutput = yield* Schema.decodeUnknown(options.module.signature.outputSchema)(expected).pipe(
      Effect.mapError(() =>
        new EvaluationFailed({
          index: options.index,
          message: "expected output does not match module output schema"
        })
      )
    )
    const scores = yield* Effect.forEach(options.metrics, (entry) =>
      Tuple.getSecond(entry).score(prediction, expectedOutput).pipe(
        Effect.map((result) =>
          Tuple.make(Tuple.getFirst(entry), result.score)
        )
      ))

    const scoresByName: ExampleScore = Record.fromEntries(scores)
    return Data.struct({
      scores: scoresByName,
      averageScore: averageNumbers(Arr.map(scores, Tuple.getSecond))
    })
  })

/**
 * @since 0.1.0
 * @internal
 */
export const evaluateOutcome = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME,
  MR,
  E,
  R
>(options: EvaluateExampleOptions<I, O, ME, MR, E, R>) =>
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

            return new ExampleOutcome({
              result: new ExampleResult({
                index: options.index,
                scores: Record.empty(),
                failure: Option.some(failure),
                durationMs: Number.subtract(completedAt, startedAt)
              }),
              success: false,
              averageScore: 0,
              failure: Option.some(failure)
            })
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

            return new ExampleOutcome({
              result: new ExampleResult({
                index: options.index,
                scores,
                failure: Option.none(),
                durationMs: Number.subtract(completedAt, startedAt)
              }),
              success: true,
              averageScore,
              failure: Option.none<ExampleFailure>()
            })
          })
      })
    )
  })
