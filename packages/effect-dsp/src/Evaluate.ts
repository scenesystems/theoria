/**
 * Runs modules against labeled examples and aggregates metric scores.
 *
 * @remarks
 * Each example becomes a report entry instead of failing the whole evaluation
 * for an expected module, decode, or metric error. Use `run` for the report and
 * `stream` for buffered lifecycle events after evaluation completes.
 *
 * @since 0.1.0
 * @module
 */
import { Array as Arr, Data, Effect, Number, Ref, Schema, Stream } from "effect"
import type { Option, Record } from "effect"
import { Example } from "./Example.js"
import { evaluateKernel, noEvents } from "./internal/evaluate/kernel.js"
import { type Metric, Score } from "./Metric.js"
import type { Module } from "./Module.js"
import * as Prediction from "./Prediction.js"

/** Captured expected failure for one example.
 * @since 0.1.0
 * @category models
 */
export class Failure extends Schema.Class<Failure>("@scenesystems/effect-dsp/Evaluate/Failure")({
  index: Schema.Finite,
  tag: Schema.String,
  message: Schema.String
}) {}

/** Successful prediction and named metric evidence for one input position.
 * The singular score averages the configured metrics for this example.
 * @since 0.6.0
 * @category models
 */
export class Scored extends Schema.TaggedClass<Scored>("@scenesystems/effect-dsp/Evaluate/Scored")("Scored", {
  index: Schema.Int,
  example: Example,
  prediction: Prediction.schema(Schema.Unknown),
  score: Score,
  scores: Schema.Record(Schema.String, Score),
  durationMs: Schema.Finite
}) {}

/** Expected failure for an example, without a fabricated prediction or score.
 * @since 0.6.0
 * @category models
 */
export class Failed extends Schema.TaggedClass<Failed>("@scenesystems/effect-dsp/Evaluate/Failed")("Failed", {
  index: Schema.Int,
  example: Example,
  failure: Failure,
  durationMs: Schema.Finite
}) {}

/** Ordered per-example evaluation result.
 * @since 0.6.0
 * @category schemas
 */
export const Outcome = Schema.Union([Scored, Failed])
/** Decoded evaluation outcome. @since 0.6.0 @category models */
export type Outcome = typeof Outcome.Type

/** Expected error budget exhausted after in-flight work drains.
 * @since 0.6.0
 * @category errors
 */
export class TooManyErrors
  extends Schema.TaggedError<TooManyErrors>("@scenesystems/effect-dsp/Evaluate/TooManyErrors")("TooManyErrors", {
    count: Schema.Int,
    limit: Schema.Int
  })
{}

/** Ordered per-example outcomes and aggregate metric scores.
 * Averages include failureScore for every failed example, in fraction units.
 * @since 0.1.0
 * @category models
 */
export class Report extends Schema.Class<Report>("@scenesystems/effect-dsp/Evaluate/Report")({
  overallScores: Schema.Record(Schema.String, Schema.Finite),
  outcomes: Schema.Array(Outcome),
  average: Schema.Finite,
  units: Schema.Literal("fraction"),
  failures: Schema.Array(Failure),
  totalExamples: Schema.Finite,
  successCount: Schema.Finite,
  failureCount: Schema.Finite
}) {}

/** Converts a report's fraction average to percentage display units.
 * @since 0.6.0
 * @category accessors
 */
export const asPercent = (report: Report): number => Number.multiply(report.average, 100)

/** Evaluation lifecycle event schema.
 * @since 0.1.0
 * @category events
 */
export const Event = Schema.Union([
  Schema.TaggedStruct("ExampleStarted", { index: Schema.Finite, total: Schema.Finite }),
  Schema.TaggedStruct("ExampleCompleted", { index: Schema.Finite, score: Schema.Finite }),
  Schema.TaggedStruct("ExampleFailed", { failure: Failure }),
  Schema.TaggedStruct("EvaluationCompleted", { overallScore: Schema.Finite, total: Schema.Finite })
])

/** Evaluation lifecycle event.
 * @since 0.1.0
 * @category events
 */
export type Event = typeof Event.Type

/** Constructors and matcher for evaluation lifecycle events.
 * @since 0.1.0
 * @category events
 */
export const events = Data.taggedEnum<Event>()

const Examples = Schema.Array(Example)
type Examples = typeof Examples.Type

/** Evaluation configuration.
 * @since 0.1.0
 * @category models
 */
export class Options<
  I extends Schema.Struct.Fields = Schema.Struct.Fields,
  O extends Schema.Struct.Fields = Schema.Struct.Fields,
  ME = never,
  MR = never,
  E = never,
  R = never
> extends Data.Class<{
  readonly module: Module<I, O, E, R>
  readonly examples: Examples
  readonly metrics: Record.ReadonlyRecord<string, Metric<ME, MR>>
  readonly concurrency?: number
  readonly failureScore?: number
  readonly maxErrors?: Option.Option<number>
  readonly units?: "fraction"
}> {}

const Events = Schema.Array(Event)
type Events = typeof Events.Type

const appendEvent = (eventsRef: Ref.Ref<Events>) => (event: Event): Effect.Effect<void> =>
  Ref.update(eventsRef, (events) => Arr.append(events, event))

/**
 * Evaluates a module against labeled examples and returns their report.
 *
 * @remarks
 * Examples run with the requested concurrency, while returned results retain
 * input order. Metrics run sequentially in name-sorted order. A module,
 * decoding, or metric failure is stored on that example and does not fail the
 * returned Effect unless maxErrors is exceeded. Every failed example contributes
 * failureScore (default zero) to each metric and the report average. An empty
 * dataset scores zero. Report units are always fractions, never percentages.
 *
 * Defects and interruption remain in the Effect cause and are not converted to
 * example failures.
 *
 * @param options - Module, labeled examples, metrics, and example concurrency.
 * @returns A report containing every input position and aggregate scores.
 * @typeParam I - Input fields accepted by the evaluated module.
 * @typeParam O - Output fields returned by the evaluated module.
 * @typeParam ME - Expected failure from the configured metrics.
 * @typeParam MR - Services required by the configured metrics.
 *
 * @since 0.1.0
 * @category operations
 */
export const run = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never,
  E = never,
  R = never
>(
  options: Options<I, O, ME, MR, E, R>
) => evaluateKernel(options, noEvents)

/**
 * Evaluates labeled examples and returns the buffered lifecycle events.
 *
 * @remarks
 * Evaluation completes before the Stream emits. With concurrent examples,
 * start and terminal events follow execution timing; `EvaluationCompleted` is
 * last. The report itself is not emitted.
 *
 * Expected per-example failures become `ExampleFailed` values. Defects and
 * interruption fail the Stream. The module and metrics retain their service
 * requirements.
 *
 * @param options - Module, labeled examples, metrics, and example concurrency.
 * @returns A finite Stream backed by the events buffered during evaluation.
 * @typeParam I - Input fields accepted by the evaluated module.
 * @typeParam O - Output fields returned by the evaluated module.
 * @typeParam ME - Expected failure from the configured metrics.
 * @typeParam MR - Services required by the configured metrics.
 *
 * @since 0.1.0
 * @category operations
 */
export const stream = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never,
  E = never,
  R = never
>(
  options: Options<I, O, ME, MR, E, R>
) =>
  Stream.unwrap(
    Effect.gen(function*() {
      const eventsRef = yield* Ref.make<Events>(Arr.empty<Event>())

      yield* evaluateKernel(options, appendEvent(eventsRef))

      const events = yield* Ref.get(eventsRef)

      return Stream.fromIterable(events)
    })
  )
