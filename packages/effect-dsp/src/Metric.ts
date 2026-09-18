/**
 * Named scoring operations and their result constructor.
 *
 * @since 0.1.0
 * @module
 */
import { Data, Schema } from "effect"
import type { Effect } from "effect"
import {
  contains as containsInternal,
  exactMatch as exactMatchInternal,
  f1 as f1Internal
} from "./internal/metric/builtins.js"
import { compose as composeInternal } from "./internal/metric/compose.js"
import { fromEffect as fromEffectInternal, make as makeInternal } from "./internal/metric/constructors.js"

/**
 * Constructs a numeric score with optional evaluator feedback.
 *
 * @remarks
 * Scores are not normalized or range-checked. Weighting, when needed, belongs
 * in the scoring function; {@link compose} gives every child score equal weight.
 *
 * @since 0.1.0
 * @category models
 */
export class Result extends Schema.Class<Result>("@scenesystems/effect-dsp/Metric/Result")({
  score: Schema.Number,
  feedback: Schema.optional(Schema.String)
}) {}

/**
 * Effectful scorer over decoded output values.
 * @since 0.1.0
 * @category models
 */
export type Fn<A, E = never, R = never> = (
  prediction: A,
  expected: A
) => Effect.Effect<Result, E, R>

/**
 * Synchronous scorer over decoded output values.
 * @since 0.1.0
 * @category models
 */
export type PureFn<A> = (prediction: A, expected: A) => Result

/**
 * Associates a diagnostic name with an effectful scoring operation.
 *
 * @remarks
 * Both scorer arguments have the output schema's decoded type. Its typed
 * failures and requirements flow through evaluation and optimization unchanged.
 *
 * @typeParam E - Expected scoring failure.
 * @typeParam R - Services required while scoring.
 * @typeParam A - Decoded output values accepted by the scorer.
 *
 * @since 0.1.0
 * @category models
 */
export class Metric<E = never, R = never, A = unknown> extends Data.TaggedClass("Metric")<{
  /** Diagnostic name; evaluation report keys come from the containing metric record. */
  readonly name: string
  /** Scorer whose expected failure and requirements remain in callers' Effect types. */
  readonly score: Fn<A, E, R>
}> {}

/** Scores normalized scalar-field substring containment.
 * @since 0.1.0
 * @category metrics
 */
export const contains = containsInternal
/** Scores normalized scalar-field equality.
 * @since 0.1.0
 * @category metrics
 */
export const exactMatch = exactMatchInternal
/** Scores normalized multiset-token F1.
 * @since 0.1.0
 * @category metrics
 */
export const f1 = f1Internal
/** Combines named metrics with an equal-weight arithmetic mean.
 * @since 0.1.0
 * @category combinators
 */
export const compose = composeInternal
/** Retains an effectful scorer's error and requirement channels.
 * @since 0.1.0
 * @category constructors
 */
export const fromEffect = fromEffectInternal
/** Wraps a synchronous scorer as an infallible metric.
 * @since 0.1.0
 * @category constructors
 */
export const make = makeInternal
