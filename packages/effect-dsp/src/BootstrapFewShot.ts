/**
 * Collects demonstrations from scored module traces.
 *
 * @see {@link https://arxiv.org/abs/2310.03714 | Khattab et al., "DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines", 2023}
 * @since 0.1.0
 * @module
 */
import type * as LanguageModel from "@effect/ai/LanguageModel"
import * as Emitter from "@scenesystems/effect-study/Emitter"
import {
  Array as Arr,
  Boolean as Bool,
  Data,
  Effect,
  Exit,
  Match,
  Number as Num,
  Option,
  Predicate,
  Ref,
  Schema,
  Stream,
  String as Str
} from "effect"
import type * as Layer from "effect/Layer"
import { BootstrapFailed } from "./DspError.js"
import { Example } from "./Example.js"
import { labeledTrainset, normalizeNonNegative } from "./internal/bootstrapFewShot/runtime/demos.js"
import {
  BootstrapState,
  defaultBootstrapFallbackDemoCount,
  defaultBootstrapThreshold,
  demoCount,
  PredictorDemos
} from "./internal/bootstrapFewShot/runtime/model.js"
import { bootstrapRound, BootstrapRoundOptions } from "./internal/bootstrapFewShot/runtime/round.js"
import { collectModuleParamRefs } from "./internal/moduleParameters.js"
import { Options as LabeledFewShotOptions, run as labeledFewShot } from "./LabeledFewShot.js"
import type { Metric } from "./Metric.js"
import type { Module } from "./Module.js"
import { withDemos as withModuleParamsDemos } from "./ModuleParameters.js"

const averageScore = (state: BootstrapState): number =>
  Bool.match(Num.greaterThan(state.evaluatedExamples, 0), {
    onFalse: () => 0,
    onTrue: () => Num.unsafeDivide(state.scoreSum, state.evaluatedExamples)
  })

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
export const Event = Schema.Union(
  Schema.TaggedStruct("RoundStarted", { round: Schema.Number, maxRounds: Schema.Number }),
  Schema.TaggedStruct("TraceAccepted", { moduleName: Schema.String, score: Schema.Number }),
  Schema.TaggedStruct("TraceRejected", {
    moduleName: Schema.String,
    score: Schema.Number,
    threshold: Schema.Number
  }),
  Schema.TaggedStruct("RoundCompleted", { round: Schema.Number, demosCollected: Schema.Number }),
  Schema.TaggedStruct("BootstrapFallbackActivated", {
    threshold: Schema.Number,
    roundsAttempted: Schema.Number,
    acceptedTraces: Schema.Number,
    rejectedTraces: Schema.Number,
    bestScoreSeen: Schema.Boolean,
    bestScore: Schema.Number,
    averageScore: Schema.Number,
    fallbackLabeledDemoCount: Schema.Number
  }),
  Schema.TaggedStruct("BootstrapFallbackCompleted", {
    fallbackDemosAdded: Schema.Number,
    totalDemos: Schema.Number,
    roundsUsed: Schema.Number
  }),
  Schema.TaggedStruct("BootstrapCompleted", {
    totalDemos: Schema.Number,
    roundsUsed: Schema.Number,
    fallbackUsed: Schema.Boolean
  })
)

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
  tag: Schema.typeSchema(Schema.pluck(Event, "_tag")),
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
    Match.tag("BootstrapFallbackActivated", (event) =>
      `threshold=${event.threshold} roundsAttempted=${event.roundsAttempted} acceptedTraces=${event.acceptedTraces} rejectedTraces=${event.rejectedTraces} bestScoreSeen=${event.bestScoreSeen} bestScore=${event.bestScore} averageScore=${event.averageScore} fallbackLabeledDemoCount=${event.fallbackLabeledDemoCount}`),
    Match.tag("BootstrapFallbackCompleted", ({ fallbackDemosAdded, totalDemos, roundsUsed }) =>
      `fallbackDemosAdded=${fallbackDemosAdded} totalDemos=${totalDemos} roundsUsed=${roundsUsed}`),
    Match.tag("BootstrapCompleted", ({ totalDemos, roundsUsed, fallbackUsed }) =>
      `totalDemos=${totalDemos} roundsUsed=${roundsUsed} fallbackUsed=${fallbackUsed}`),
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
export class EventSummary extends Schema.Class<EventSummary>("@scenesystems/effect-dsp/BootstrapFewShot/EventSummary")({
  totalEvents: Schema.Number,
  roundsStarted: Schema.Number,
  roundsCompleted: Schema.Number,
  traceAcceptedCount: Schema.Number,
  traceRejectedCount: Schema.Number,
  fallbackActivatedSeen: Schema.Boolean,
  fallbackCompletedSeen: Schema.Boolean,
  fallbackUsed: Schema.Boolean,
  completedSeen: Schema.Boolean,
  totalDemos: Schema.Number,
  roundsUsed: Schema.Number
}) {}

const emptySummary = new EventSummary({
  totalEvents: 0,
  roundsStarted: 0,
  roundsCompleted: 0,
  traceAcceptedCount: 0,
  traceRejectedCount: 0,
  fallbackActivatedSeen: false,
  fallbackCompletedSeen: false,
  fallbackUsed: false,
  completedSeen: false,
  totalDemos: 0,
  roundsUsed: 0
})

/** Summarizes bootstrap lifecycle events.
 * @since 0.1.0
 * @category combinators
 */
export const summarizeEvents = (input: Iterable<Event>): EventSummary =>
  Arr.reduce(input, emptySummary, (summary, event) => {
    const next = new EventSummary({ ...summary, totalEvents: Num.increment(summary.totalEvents) })
    return Match.value(event).pipe(
      Match.tag("RoundStarted", () => new EventSummary({ ...next, roundsStarted: Num.increment(next.roundsStarted) })),
      Match.tag(
        "TraceAccepted",
        () => new EventSummary({ ...next, traceAcceptedCount: Num.increment(next.traceAcceptedCount) })
      ),
      Match.tag(
        "TraceRejected",
        () => new EventSummary({ ...next, traceRejectedCount: Num.increment(next.traceRejectedCount) })
      ),
      Match.tag(
        "RoundCompleted",
        () => new EventSummary({ ...next, roundsCompleted: Num.increment(next.roundsCompleted) })
      ),
      Match.tag("BootstrapFallbackActivated", () => new EventSummary({ ...next, fallbackActivatedSeen: true })),
      Match.tag("BootstrapFallbackCompleted", () => new EventSummary({ ...next, fallbackCompletedSeen: true })),
      Match.tag(
        "BootstrapCompleted",
        ({ fallbackUsed, roundsUsed, totalDemos }) =>
          new EventSummary({ ...next, fallbackUsed, roundsUsed, totalDemos, completedSeen: true })
      ),
      Match.exhaustive
    )
  })

const bootstrapFailure = (message: string, threshold: number, state: BootstrapState): BootstrapFailed =>
  new BootstrapFailed({
    message,
    roundsAttempted: state.roundsAttempted,
    totalTraces: state.totalTraces,
    threshold,
    acceptedTraces: state.acceptedTraces,
    rejectedTraces: state.rejectedTraces,
    evaluatedExamples: state.evaluatedExamples,
    bestScoreSeen: state.bestScoreSeen,
    bestScore: state.bestScore,
    averageScore: averageScore(state)
  })

/**
 * Configures trace collection and labeled fallback.
 *
 * @remarks
 * Only examples with an `output` are retained. Each round visits that filtered
 * sequence in order. Count options are rounded down; negative and non-finite
 * values become zero. Existing demonstrations are truncated to the bootstrap
 * cap before the first round.
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
  /** Module mutated in place and returned by the optimizer. */
  readonly module: Module<I, O, E, R>
  /** Training examples used for teacher runs and labeled fallback. */
  readonly trainset: Examples
  /** Scores each module output; values greater than or equal to `threshold` are accepted. */
  readonly metric: Metric<ME, MR, Schema.Schema.Type<Schema.Struct<O>>>
  /** Maximum filtered-trainset passes. Zero skips trace collection. */
  readonly maxRounds: number
  /** Trace-demo cap, including retained existing demos but excluding labeled fallback. */
  readonly maxBootstrappedDemos: number
  /** Positive prefix length after unlabeled examples are removed; other values leave the sequence unbounded. */
  readonly maxLabeledDemos?: number
  /** Minimum accepted score. Defaults to `1`. */
  readonly threshold?: number
  /** Whether zero accepted traces trigger labeled fallback. Defaults to `true`. */
  readonly fallbackToLabeledFewShot?: boolean
  /** Labeled fallback count, independent of `maxBootstrappedDemos`; defaults to `3`. */
  readonly fallbackLabeledDemoCount?: number
  /** Layer used only while running teacher traces; otherwise the ambient language model is used. */
  readonly teacher?: Layer.Layer<LanguageModel.LanguageModel, never, never>
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
 * Events are awaited in execution order. A round evaluates every retained
 * example and accepts the completed stage traces when the root score meets the
 * threshold. Each destination validates and structurally deduplicates its own
 * encoded values. Composed roots use their schema-encoded successful result.
 * Collection stops when every destination reaches its cap, the round cap is
 * reached, or a round adds no demos. Intermediate ReAct turns are not demos.
 *
 * If no demonstration remains, labeled fallback runs by default. Disabled or
 * empty fallback fails with `BootstrapFailed`. Input decoding, module calls,
 * metrics, and event-sink defects preserve their normal Effect behavior. The
 * same module object is returned after mutation. Failure and interruption
 * restore the entire initial parameter tree; successful runs retain their demos.
 *
 * @typeParam I - Module input fields decoded from training examples.
 * @typeParam O - Module output fields captured from accepted traces.
 * @typeParam ME - Expected failure type of the metric.
 * @typeParam MR - Services required by the metric.
 * @param options - Training data, metric, module, caps, threshold, and optional teacher.
 * @param emit - Infallible sink awaited once per emitted lifecycle event.
 * @returns The supplied module after bootstrap or labeled fallback updates.
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
  emit: EventSink<EE, ER>
) =>
  Effect.acquireUseRelease(
    Effect.forEach(collectModuleParamRefs(options.module), (owner) =>
      Ref.get(owner.params).pipe(
        Effect.map((params) => new PredictorDemos({ owner, params }))
      )),
    (snapshots) =>
      Effect.gen(function*() {
        const maxRounds = normalizeNonNegative(options.maxRounds)
        const maxBootstrappedDemos = normalizeNonNegative(options.maxBootstrappedDemos)
        const threshold = Option.getOrElse(Option.fromNullable(options.threshold), () => defaultBootstrapThreshold)
        const fallbackToLabeledFewShot = Option.getOrElse(
          Option.fromNullable(options.fallbackToLabeledFewShot),
          () => true
        )
        const fallbackLabeledDemoCount = normalizeNonNegative(
          Option.getOrElse(
            Option.fromNullable(options.fallbackLabeledDemoCount),
            () => defaultBootstrapFallbackDemoCount
          )
        )
        const teacher = Option.fromNullable(options.teacher)
        const initialPredictors = yield* Effect.forEach(snapshots, (snapshot) =>
          Effect.forEach(
            Arr.take(snapshot.params.demos, maxBootstrappedDemos),
            snapshot.owner.demonstrationCodec.decode
          )
            .pipe(
              Effect.map((demos) =>
                new PredictorDemos({
                  owner: snapshot.owner,
                  params: withModuleParamsDemos(snapshot.params, demos)
                })
              )
            ))
        const trainset = labeledTrainset(options.trainset, Option.fromNullable(options.maxLabeledDemos))

        yield* Effect.forEach(initialPredictors, (predictor) => Ref.set(predictor.owner.params, predictor.params), {
          discard: true
        }).pipe(Effect.uninterruptible)

        const finalState = yield* Effect.iterate(
          new BootstrapState({
            round: 1,
            roundsAttempted: 0,
            predictors: initialPredictors,
            totalTraces: 0,
            acceptedTraces: 0,
            rejectedTraces: 0,
            evaluatedExamples: 0,
            scoreSum: 0,
            bestScoreSeen: false,
            bestScore: 0,
            fallbackUsed: false,
            continue: true
          }),
          {
            while: Predicate.and(
              Predicate.and(
                (state: BootstrapState) => state.continue,
                (state) => Num.lessThanOrEqualTo(state.round, maxRounds)
              ),
              (state) =>
                Arr.some(
                  state.predictors,
                  (predictor) => Num.lessThan(Arr.length(predictor.params.demos), maxBootstrappedDemos)
                )
            ),
            body: (state) =>
              bootstrapRound(
                new BootstrapRoundOptions({
                  state,
                  module: options.module,
                  trainset,
                  metric: options.metric,
                  threshold,
                  emit,
                  teacher,
                  maxBootstrappedDemos,
                  maxRounds
                })
              )
          }
        )

        return yield* Effect.if(Num.Equivalence(demoCount(finalState.predictors), 0), {
          onFalse: () =>
            emit(
              events.BootstrapCompleted({
                totalDemos: demoCount(finalState.predictors),
                roundsUsed: finalState.roundsAttempted,
                fallbackUsed: false
              })
            ).pipe(Effect.as(options.module)),
          onTrue: () =>
            Effect.if(
              Bool.match(fallbackToLabeledFewShot, {
                onFalse: () => false,
                onTrue: () => Num.greaterThan(fallbackLabeledDemoCount, 0)
              }),
              {
                onFalse: () => bootstrapFailure("BootstrapFewShot produced zero accepted demos", threshold, finalState),
                onTrue: () =>
                  Effect.gen(function*() {
                    yield* emit(
                      events.BootstrapFallbackActivated({
                        threshold,
                        roundsAttempted: finalState.roundsAttempted,
                        acceptedTraces: finalState.acceptedTraces,
                        rejectedTraces: finalState.rejectedTraces,
                        bestScoreSeen: finalState.bestScoreSeen,
                        bestScore: finalState.bestScore,
                        averageScore: averageScore(finalState),
                        fallbackLabeledDemoCount
                      })
                    )

                    const optimized = yield* labeledFewShot(
                      new LabeledFewShotOptions({
                        module: options.module,
                        trainset,
                        k: fallbackLabeledDemoCount
                      })
                    )
                    const fallbackDemos = demoCount(
                      yield* Effect.forEach(finalState.predictors, (predictor) =>
                        Ref.get(predictor.owner.params).pipe(
                          Effect.map((params) => new PredictorDemos({ owner: predictor.owner, params }))
                        ))
                    )

                    return yield* Effect.if(Num.Equivalence(fallbackDemos, 0), {
                      onTrue: () =>
                        bootstrapFailure(
                          "BootstrapFewShot produced zero accepted demos and labeled fallback yielded zero demos",
                          threshold,
                          finalState
                        ),
                      onFalse: () =>
                        Effect.gen(function*() {
                          yield* emit(
                            events.BootstrapFallbackCompleted({
                              fallbackDemosAdded: fallbackDemos,
                              totalDemos: fallbackDemos,
                              roundsUsed: finalState.roundsAttempted
                            })
                          )
                          yield* emit(
                            events.BootstrapCompleted({
                              totalDemos: fallbackDemos,
                              roundsUsed: finalState.roundsAttempted,
                              fallbackUsed: true
                            })
                          )

                          return optimized
                        })
                    })
                  })
              }
            )
        })
      }),
    (snapshots, exit) =>
      Effect.when(
        Effect.forEach(snapshots, (snapshot) => Ref.set(snapshot.owner.params, snapshot.params), { discard: true }),
        () => Exit.isFailure(exit)
      )
  )

/**
 * Adds trace demonstrations without retaining lifecycle events.
 *
 * @remarks
 * Mutation, fallback, and failures match {@link runWithEvents}.
 *
 * @param options - Bootstrap configuration passed to the event-aware operation.
 * @returns The supplied module after successful optimization.
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
 * Events retain execution order. The final module is available through the
 * mutated `options.module`, not as a stream element. Bootstrap failures fail the
 * stream.
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
