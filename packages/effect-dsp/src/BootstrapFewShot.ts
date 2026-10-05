/**
 * Collects demonstrations from scored module traces.
 *
 * @see {@link https://arxiv.org/abs/2310.03714 | Khattab et al., "DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines", 2023}
 * @since 0.1.0
 * @module
 */
import { empty as emptySettings, type ModelSettings } from "@scenesystems/effect-lm/ModelSettings"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import * as Emitter from "@scenesystems/effect-study/Emitter"
import {
  Array as Arr,
  Chunk,
  Data,
  Effect,
  Match,
  Number as Num,
  Option,
  Random,
  Record,
  Ref,
  Schema,
  Stream,
  String as Str,
  Struct,
  Tuple
} from "effect"
import { Example, Id as ExampleId, id as exampleId } from "./Example.js"
import { sampleLabeled } from "./internal/labeledFewShot/sampling.js"
import * as LabeledFewShot from "./LabeledFewShot.js"
import { type Metric, Score } from "./Metric.js"
import { bound, type Module } from "./Module.js"
import { predictors } from "./ModuleGraph.js"
import { withDemos as withModuleParametersDemos } from "./ModuleParameters.js"
import * as Optimized from "./Optimized.js"
import * as ParameterSet from "./ParameterSet.js"
import * as TeacherTrace from "./TeacherTrace.js"

const normalizeNonNegative = (value: number): number =>
  Numeric.isFinite(value) ? Numeric.max(0, Numeric.floor(value)) : 0

/**
 * Ordered dataset rows consumed by BootstrapFewShot.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Examples = Schema.Array(Example)

/**
 * Ordered dataset rows consumed by BootstrapFewShot.
 *
 * @since 0.1.0
 * @category type-level
 */
export type Examples = typeof Examples.Type

/** Lifecycle events emitted while bootstrap optimization runs.
 * @since 0.1.0
 * @category events
 */
export const Event = Schema.Union([
  Schema.TaggedStruct("RoundStarted", { round: Schema.Finite, maxRounds: Schema.Finite }),
  Schema.TaggedStruct("TraceAccepted", { moduleName: Schema.String, score: Score.fields.value }),
  Schema.TaggedStruct("TraceRejected", {
    moduleName: Schema.String,
    score: Score.fields.value,
    threshold: Score.fields.value
  }),
  Schema.TaggedStruct("RoundCompleted", { round: Schema.Finite, demosCollected: Schema.Finite }),
  Schema.TaggedStruct("BootstrapCompleted", {
    totalDemos: Schema.Finite,
    roundsUsed: Schema.Finite,
    labeledCount: Schema.Int
  })
])

/** Bootstrap lifecycle event.
 * @since 0.1.0
 * @category events
 */
export type Event = typeof Event.Type

/** Constructors and exhaustive matching for bootstrap events.
 * @since 0.1.0
 * @category events
 */
export const events = Data.taggedEnum<Event>()

/** Effectful bootstrap event observer.
 * @since 0.1.0
 * @category models
 */
export type EventSink<E = never, R = never> = (event: Event) => Effect.Effect<void, E, R>

/** Formatted bootstrap progress line.
 * @since 0.1.0
 * @category models
 */
export class ProgressLine extends Schema.Class<ProgressLine>("@scenesystems/effect-dsp/BootstrapFewShot/ProgressLine")({
  tag: Schema.String,
  details: Schema.String,
  text: Schema.String
}) {}

const progressDetails = (event: Event): string =>
  Match.value(event).pipe(
    Match.tag("RoundStarted", ({ round, maxRounds }) => `round=${round} maxRounds=${maxRounds}`),
    Match.tag("TraceAccepted", ({ moduleName, score }) => `module=${moduleName} score=${score}`),
    Match.tag("TraceRejected", ({ moduleName, score, threshold }) =>
      `module=${moduleName} score=${score} threshold=${threshold}`),
    Match.tag("RoundCompleted", ({ round, demosCollected }) =>
      `round=${round} demosCollected=${demosCollected}`),
    Match.tag("BootstrapCompleted", ({ totalDemos, roundsUsed, labeledCount }) =>
      `totalDemos=${totalDemos} roundsUsed=${roundsUsed} labeledCount=${labeledCount}`),
    Match.exhaustive
  )

/** Formats one bootstrap event.
 * @since 0.1.0
 * @category formatters
 */
export const formatEvent = (event: Event): ProgressLine => {
  const details = progressDetails(event)
  return new ProgressLine({ tag: event._tag, details, text: Str.concat(Str.concat(event._tag, " "), details) })
}

/** Effectful formatted-progress observer.
 * @since 0.1.0
 * @category models
 */
export type ProgressSink<E = never, R = never> = (line: ProgressLine) => Effect.Effect<void, E, R>

/** Observes formatted progress without changing stream values.
 * @since 0.1.0
 * @category combinators
 */
export const tapProgress =
  <E, R>(sink: ProgressSink<E, R>) =>
  <SE, SR>(stream: Stream.Stream<Event, SE, SR>): Stream.Stream<Event, E | SE, R | SR> =>
    Stream.tap(stream, (event) => sink(formatEvent(event)))

/** Folded bootstrap lifecycle counters.
 * @since 0.1.0
 * @category models
 */
export class Report extends Schema.Class<Report>("@scenesystems/effect-dsp/BootstrapFewShot/Report")({
  totalEvents: Schema.Finite,
  roundsStarted: Schema.Finite,
  roundsCompleted: Schema.Finite,
  traceAcceptedCount: Schema.Finite,
  traceRejectedCount: Schema.Finite,
  labeledCount: Schema.Int,
  completedSeen: Schema.Boolean,
  totalDemos: Schema.Finite,
  roundsUsed: Schema.Finite,
  acceptedCount: Schema.Int.pipe(Schema.withConstructorDefault(Effect.succeed(0))),
  rejectedCount: Schema.Int.pipe(Schema.withConstructorDefault(Effect.succeed(0))),
  demoSources: Schema.Record(
    Schema.String,
    Schema.Struct({ bootstrapped: Schema.Array(ExampleId), labeled: Schema.Array(ExampleId) })
  ).pipe(Schema.withConstructorDefault(Effect.succeed({})))
}) {}

const emptySummary = new Report({
  totalEvents: 0,
  roundsStarted: 0,
  roundsCompleted: 0,
  traceAcceptedCount: 0,
  traceRejectedCount: 0,
  labeledCount: 0,
  completedSeen: false,
  totalDemos: 0,
  roundsUsed: 0
})

/** Summarizes bootstrap lifecycle events.
 * @since 0.1.0
 * @category combinators
 */
export const summarizeEvents = (input: Iterable<Event>): Report =>
  Arr.reduce(input, emptySummary, (summary, event) => {
    const fields = Match.value(event).pipe(
      Match.tag("RoundStarted", () => ({ roundsStarted: Num.increment(summary.roundsStarted) })),
      Match.tag("TraceAccepted", () => ({ traceAcceptedCount: Num.increment(summary.traceAcceptedCount) })),
      Match.tag("TraceRejected", () => ({ traceRejectedCount: Num.increment(summary.traceRejectedCount) })),
      Match.tag("RoundCompleted", () => ({ roundsCompleted: Num.increment(summary.roundsCompleted) })),
      Match.tag("BootstrapCompleted", ({ labeledCount, roundsUsed, totalDemos }) => ({
        labeledCount,
        roundsUsed,
        totalDemos,
        completedSeen: true
      })),
      Match.exhaustive
    )
    return new Report(Struct.assign(summary, {
      totalEvents: Num.increment(summary.totalEvents),
      ...fields
    }))
  })

/**
 * Configures teacher trace collection and labeled demonstration filling.
 *
 * @remarks
 * Each round visits unaccepted examples in order. Count options are rounded
 * down; negative and non-finite values become zero. A teacher with boundParameters
 * is compiled and retains its demonstrations. Default and plain teachers are
 * uncompiled and prewarmed through LabeledFewShot when maxLabeledDemos is positive.
 * The compiled student's demonstrations replace its existing demonstrations.
 *
 * @typeParam I - Module input fields decoded from training examples.
 * @typeParam O - Module output fields used to create accepted demonstrations.
 * @typeParam ME - Expected failure type of the metric.
 * @typeParam MR - Services required by the metric.
 *
 * @since 0.1.0
 * @category models
 */
export class Options<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never,
  E = never,
  R = never
> extends Data.Class<{
  /** Program whose unfrozen leaf demonstrations are optimized in a bound copy. */
  readonly module: Module<I, O, E, R>
  /** Training examples used for teacher runs and labeled filling. */
  readonly trainset: Examples
  /** Scores each teacher prediction in bootstrap context. */
  readonly metric: Metric<ME, MR>
  /** Maximum training passes, default 1. Zero skips trace collection. */
  readonly maxRounds?: number
  /** Maximum accepted demonstrations per predictor, default 4. */
  readonly maxBootstrappedDemos?: number
  /** Total capacity up to which labeled rows fill after trace demos, default 16. */
  readonly maxLabeledDemos?: number
  /** Optional score threshold; absent accepts nonzero scores. */
  readonly metricThreshold?: Option.Option<number>
  /** Failure count that raises TooManyErrors; absent leaves the budget unlimited. */
  readonly maxErrors?: Option.Option<number>
  /** Teacher program; defaults to an immutable student snapshot. */
  readonly teacher?: Module<I, O, E, R>
  /** Generation settings applied only to the teacher role. */
  readonly teacherSettings?: ModelSettings
}> {}

/**
 * Discards bootstrap events without adding failures or requirements.
 *
 * @since 0.1.0
 * @category constants
 */
export const noEvents: EventSink = () => Effect.void

const streamBootstrapFewShotEvents = <A, E, R>(
  runWithEvents: (emit: EventSink) => Effect.Effect<A, E, R>
): Stream.Stream<Event, E, R> => Emitter.toStream(runWithEvents)

/**
 * Adds accepted trace demonstrations to a module while emitting lifecycle events.
 *
 * @remarks
 * Events are awaited during teacher execution. Accepted examples contribute
 * one demonstration per predictor through TeacherTrace.firstPerPredictor;
 * duplicate outputs from different examples are retained. Collection stops
 * when every trainable predictor reaches its cap or the round cap is reached.
 * Unaccepted labeled examples fill max(0, maxLabeledDemos - bootstrappedCount)
 * slots per predictor. Zero demonstrations is a valid result. Expected model
 * and metric failures consume maxErrors; observer errors do not.
 * The returned program binds the learned parameters. No caller refs change,
 * including when a round fails or is interrupted.
 *
 * @typeParam I - Module input fields decoded from training examples.
 * @typeParam O - Module output fields captured from accepted traces.
 * @typeParam ME - Expected failure type of the metric.
 * @typeParam MR - Services required by the metric.
 * @param options - Training data, metric, module, caps, threshold, and optional teacher.
 * @param observe - Sink awaited once per emitted lifecycle event.
 * @returns A bound program, its parameters, and the folded lifecycle report.
 *
 * @see {@link https://arxiv.org/abs/2310.03714 | Khattab et al. (2023)}
 * @since 0.1.0
 * @category constructors
 */
export const runWithEvents = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never,
  E = never,
  R = never,
  EE = never,
  ER = never
>(
  options: Options<I, O, ME, MR, E, R>,
  observe: EventSink<EE, ER>
) =>
  Effect.gen(function*() {
    const before = yield* ParameterSet.snapshot(options.module)
    const predictorsToTrain = Arr.filter(Arr.fromIterable(predictors(options.module)), (predictor) => !predictor.frozen)
    const recorded = yield* Ref.make(Arr.empty<Event>())
    const emit: EventSink<EE, ER> = (event) =>
      Ref.update(recorded, Arr.append(event)).pipe(Effect.andThen(observe(event)))
    const maxRounds = normalizeNonNegative(options.maxRounds ?? 1)
    const maxBootstrappedDemos = normalizeNonNegative(options.maxBootstrappedDemos ?? 4)
    const maxLabeledDemos = normalizeNonNegative(options.maxLabeledDemos ?? 16)
    if (options.teacher === options.module) {
      return yield* new TeacherTrace.IncompatibleTeacher({
        message: "Teacher and student must be distinct executable programs"
      })
    }
    const sourceTeacher = options.teacher ??
      bound(options.module, Record.map(before, (parameters) => withModuleParametersDemos(parameters, [])))
    const teacher = maxLabeledDemos > 0 &&
        Option.isNone(Option.fromUndefinedOr(options.teacher?.boundParameters))
      ? (yield* LabeledFewShot.run(
        new LabeledFewShot.Options({
          module: sourceTeacher,
          trainset: options.trainset,
          k: maxLabeledDemos,
          seed: 0
        })
      )).program
      : sourceTeacher
    const demoCounts = yield* Ref.make<Record.ReadonlyRecord<string, number>>(
      Record.fromEntries(Arr.map(predictorsToTrain, (predictor) => Tuple.make(predictor.path, 0)))
    )
    const collected = yield* TeacherTrace.collect(
      new TeacherTrace.Options({
        student: options.module,
        teacher: Option.some(teacher),
        teacherSettings: options.teacherSettings ?? emptySettings,
        trainset: Chunk.fromIterable(options.trainset),
        metric: options.metric,
        threshold: options.metricThreshold ?? Option.none(),
        maxErrors: options.maxErrors ?? Option.none(),
        maxRounds,
        concurrency: 1,
        stopWhen: (accepted) =>
          Arr.every(predictorsToTrain, (predictor) =>
            Chunk.reduce(accepted, 0, (count, entry) =>
              count +
              (Option.exists(Record.get(entry.demosByPredictor, predictor.path), (demos) => Chunk.isNonEmpty(demos))
                ? 1
                : 0)) >= maxBootstrappedDemos)
      }),
      (event) =>
        Match.value(event).pipe(
          Match.tag("RoundStarted", ({ round }) => emit(events.RoundStarted({ round: round + 1, maxRounds }))),
          Match.tag("ExampleAccepted", (accepted) =>
            Effect.gen(function*() {
              yield* Ref.update(demoCounts, (counts) =>
                Record.map(counts, (count, path) =>
                  Option.exists(Record.get(accepted.demosByPredictor, path), Chunk.isNonEmpty)
                    ? Numeric.min(count + 1, maxBootstrappedDemos)
                    : count))
              yield* Effect.forEach(accepted.trace.selected, (trace) =>
                emit(events.TraceAccepted({ moduleName: trace.moduleName, score: accepted.score.value })))
            })),
          Match.tag("ExampleRejected", (rejected) =>
            emit(events.TraceRejected({
              moduleName: options.module.name,
              score: Option.match(rejected.score, {
                onNone: () =>
                  0,
                onSome: (score) => score.value
              }),
              threshold: Option.getOrElse(options.metricThreshold ?? Option.none(), () => 0)
            }))),
          Match.tag("RoundCompleted", ({ round }) =>
            Effect.gen(function*() {
              yield* emit(
                events.RoundCompleted({
                  round: round + 1,
                  demosCollected: Arr.reduce(Record.values(yield* Ref.get(demoCounts)), 0, Num.sum)
                })
              )
            })),
          Match.exhaustive
        )
    )
    const accepted = Arr.map(Arr.fromIterable(collected.accepted), TeacherTrace.firstPerPredictor)
    const rejected = Arr.fromIterable(collected.rejected)
    const raw = yield* Effect.filter(
      options.trainset,
      (example) => exampleId(example).pipe(Effect.map((id) => !Arr.some(accepted, (entry) => entry.exampleId === id)))
    )
    const entries = yield* Effect.forEach(predictorsToTrain, (predictor) =>
      Effect.gen(function*() {
        const bootstrapped = Arr.take(
          Arr.flatMap(
            accepted,
            (entry) =>
              Arr.fromIterable(Option.getOrElse(Record.get(entry.demosByPredictor, predictor.path), Chunk.empty))
          ),
          maxBootstrappedDemos
        )
        const selected = yield* sampleLabeled(raw, Numeric.max(0, maxLabeledDemos - bootstrapped.length))
        const labels = yield* Effect.forEach(selected, predictor.demonstrationCodec.labeled)
        return {
          id: predictor.path,
          bootstrapped,
          labels,
          parameters: withModuleParametersDemos(
            Option.getOrThrow(Record.get(before, predictor.path)),
            Arr.appendAll(bootstrapped, labels)
          )
        }
      })).pipe(Random.withSeed(0))
    const parameters = {
      ...before,
      ...Record.fromEntries(Arr.map(entries, (entry) => Tuple.make(entry.id, entry.parameters)))
    }
    const totalDemos = Arr.reduce(entries, 0, (count, entry) => count + entry.parameters.demos.length)
    yield* emit(
      events.BootstrapCompleted({
        totalDemos,
        roundsUsed: summarizeEvents(yield* Ref.get(recorded)).roundsCompleted,
        labeledCount: Arr.reduce(entries, 0, (count, entry) => count + entry.labels.length)
      })
    )
    return new Optimized.Result({
      program: bound(options.module, parameters),
      parameters,
      report: new Report(Struct.assign(summarizeEvents(yield* Ref.get(recorded)), {
        acceptedCount: accepted.length,
        rejectedCount: rejected.length,
        demoSources: Record.fromEntries(Arr.map(entries, (entry) =>
          Tuple.make(entry.id, {
            bootstrapped: Arr.flatMap(entry.bootstrapped, (demo) => Option.toArray(demo.exampleId)),
            labeled: Arr.flatMap(entry.labels, (demo) => Option.toArray(demo.exampleId))
          })))
      }))
    })
  })

/**
 * Adds trace demonstrations without an external lifecycle observer.
 *
 * @remarks
 * Parameters, report, and failures match {@link runWithEvents}.
 *
 * @param options - Bootstrap configuration passed to the event-aware operation.
 * @returns A bound program, its parameters, and the folded lifecycle report.
 * @typeParam I - Module input fields decoded from training examples.
 * @typeParam O - Module output fields captured from accepted traces.
 * @typeParam ME - Expected failure type of the metric.
 * @typeParam MR - Services required by the metric.
 *
 * @since 0.1.0
 * @category constructors
 */
export const run = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never,
  E = never,
  R = never
>(options: Options<I, O, ME, MR, E, R>) => runWithEvents(options, noEvents)

/**
 * Emits bootstrap events as stream consumption drives optimization.
 *
 * @remarks
 * Events retain execution order. Use `runWithEvents` to retain the bound result;
 * the stream contains events only. Caller parameters remain unchanged.
 * Bootstrap failures fail the stream.
 *
 * @param options - Bootstrap configuration evaluated when the stream runs.
 * @returns A lazy stream of lifecycle events.
 * @typeParam I - Module input fields decoded from training examples.
 * @typeParam O - Module output fields captured from accepted traces.
 * @typeParam ME - Expected failure type of the metric.
 * @typeParam MR - Services required by the metric.
 *
 * @since 0.1.0
 * @category constructors
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
) => streamBootstrapFewShotEvents((emit) => runWithEvents(options, emit))
