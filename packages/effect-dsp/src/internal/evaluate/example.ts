/** Per-example scoring and lifecycle events. @since 0.1.0 @internal */
import { Array as Arr, Data, Effect, Match, Option, Order, Predicate, Record, Schema, Tuple } from "effect"
import { EvaluationFailed } from "../../DspError.js"
import { events, Failure } from "../../Evaluate.js"
import type { Event } from "../../Evaluate.js"
import type { Example } from "../../Example.js"
import { Context, type Metric, Score } from "../../Metric.js"
import { call, type Module } from "../../Module.js"
import { averageNumbers } from "../metric/score.js"

/** @internal */
export type EvaluationEventSink = (event: Event) => Effect.Effect<void>
/** @internal */
export type MetricEntry<ME, MR> = readonly [string, Metric<ME, MR>]

/** @internal */
export const sortedMetricEntries = <ME, MR>(metrics: Record.ReadonlyRecord<string, Metric<ME, MR>>) =>
  Arr.sort(Record.toEntries(metrics), Order.mapInput(Order.String, (entry: MetricEntry<ME, MR>) => entry[0]))

const failureFromUnknown = (index: number, error: unknown): Failure =>
  new Failure({
    index,
    tag: Match.value(error).pipe(
      Match.when(Schema.is(Schema.Struct({ _tag: Schema.String })), (value) => value._tag),
      Match.orElse(() => "UnknownEvaluationError")
    ),
    message: Match.value(error).pipe(
      Match.when(Predicate.isString, (message) => message),
      Match.when(Schema.is(Schema.Struct({ message: Schema.String })), (value) => value.message),
      Match.orElse(() => "Unknown evaluation error")
    )
  })

/** @internal */
export class EvaluateExampleOptions<I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME, MR, E, R>
  extends Data.Class<{
    readonly index: number
    readonly total: number
    readonly example: Example
    readonly module: Module<I, O, E, R>
    readonly metrics: Iterable<MetricEntry<ME, MR>>
    readonly emit: EvaluationEventSink
  }>
{}

/** Returns scored evidence or a typed failure for effect-study to collect.
 * @since 0.6.0
 * @internal
 */
export const evaluateExample = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME, MR, E, R>(
  options: EvaluateExampleOptions<I, O, ME, MR, E, R>
) =>
  Effect.gen(function*() {
    yield* options.emit(events.ExampleStarted({ index: options.index, total: options.total }))
    return yield* Effect.gen(function*() {
      const input = yield* Schema.decodeEffect(options.module.signature.inputSchema)(options.example.input).pipe(
        Effect.mapError(() =>
          new EvaluationFailed({ index: options.index, message: "example input does not match module input schema" })
        )
      )
      const prediction = yield* call(options.module, input)
      const context = new Context({ phase: "evaluate", trace: Option.some(prediction.trace), target: Option.none() })
      const entries = yield* Effect.forEach(options.metrics, ([name, metric]) =>
        metric.score(options.example, prediction, context).pipe(Effect.map((score) =>
          Tuple.make(name, score)
        )))
      const scores = Record.fromEntries(entries)
      const values = Arr.map(entries, ([, score]) => score)
      const score = Arr.length(values) === 1
        ? Option.getOrThrow(Arr.head(values))
        : new Score({ value: averageNumbers(Arr.map(values, (score) => score.value)), feedback: Option.none() })
      yield* options.emit(events.ExampleCompleted({ index: options.index, score: score.value }))
      return { prediction, scores, score }
    }).pipe(
      Effect.mapError((error) => failureFromUnknown(options.index, error)),
      Effect.tapError((failure) => options.emit(events.ExampleFailed({ failure })))
    )
  })
