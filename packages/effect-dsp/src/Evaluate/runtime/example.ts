/**
 * Per-example evaluation runtime.
 *
 * @since 0.1.0
 * @category internal
 * @internal
 */
import { Clock, Effect, Match, Option, Predicate } from "effect"
import type { Schema } from "effect"
import type { Example as ExampleModel } from "../../Example/index.js"
import type { Module } from "../../Module/model.js"
import { EvaluationEvent } from "../events.js"
import type { EvaluationEventType } from "../events.js"
import { ExampleFailure, ExampleResult } from "../report.js"
import { type MetricEntry, scoreExample } from "./scoring.js"

/**
 * @since 0.1.0
 * @internal
 */
export type EvaluationEventSink = (event: EvaluationEventType) => Effect.Effect<void>

/**
 * @since 0.1.0
 * @internal
 */
export type ExampleOutcome = Readonly<{
  readonly result: ExampleResult
  readonly success: boolean
  readonly averageScore: number
  readonly failure: Option.Option<ExampleFailure>
}>

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
 * @since 0.1.0
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
