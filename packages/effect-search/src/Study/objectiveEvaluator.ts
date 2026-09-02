/**
 * Objective callback contract and its overridable invocation service.
 *
 * @since 0.1.0
 */
import { Data, Effect, Layer, Predicate, Schema } from "effect"

import { type ObjectiveValue, ObjectiveValueSchema } from "../contracts/ObjectiveValue.js"
import type { ObjectiveTrialRuntime } from "./runtime/pruning.js"

/**
 * Returns an objective value with an optional non-negative evaluation cost.
 * Runtime evaluation rejects costs that are negative or non-finite. Cost units
 * are caller-defined and must remain consistent with the study's `maxCost`.
 *
 * @since 0.1.0
 * @category models
 */
export class ObjectiveReport extends Schema.Class<ObjectiveReport>("effect-search/Study/ObjectiveReport")({
  /** Scalar or objective vector used to rank the trial. */
  value: ObjectiveValueSchema,
  /** Evaluation cost charged against the study budget, in caller-defined units. */
  cost: Schema.optional(Schema.Number)
}) {}

/**
 * Objective return payload accepted from user callbacks.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ObjectiveResultSchema = Schema.Union(ObjectiveValueSchema, ObjectiveReport)

/**
 * @since 0.1.0
 * @category type-level
 */
export type ObjectiveResult = Schema.Schema.Type<typeof ObjectiveResultSchema>

/**
 * Normalized objective evaluation used by runtime execution.
 *
 * @since 0.1.0
 * @category models
 */
export class ObjectiveEvaluation extends Data.Class<{
  /** Validated objective value retained by the trial runtime. */
  readonly value: ObjectiveValue
  /** Validated cost charged to the study when the objective reported one. */
  readonly cost?: number
}> {}

/**
 * Evaluates one decoded configuration and may report pruning progress or request
 * study termination through the trial runtime. Depending on concurrency, retry,
 * repeated-evaluation, and cache settings, callbacks may overlap, run more than
 * once per trial, or be skipped on a cache hit. Callback failures become typed
 * trial failures after retry handling.
 *
 * @typeParam Config - Decoded search-space configuration passed to the callback.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ObjectiveFunction<Config = unknown> = (
  config: Config,
  runtime: ObjectiveTrialRuntime
) => Effect.Effect<ObjectiveResult, unknown>

/**
 * Accepts callable values at the plan-decoding boundary. It does not inspect the
 * callback's parameters, return value, failure channel, or requirements.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ObjectiveFunctionSchema = Schema.declare(
  Predicate.isFunction,
  {
    identifier: "effect-search/Study/ObjectiveFunction"
  }
)

/**
 * Defines the invocation boundary between study execution and objective
 * callbacks. Custom implementations may add instrumentation or remote dispatch
 * while preserving the callback's value and failure channels.
 *
 * @since 0.1.0
 * @category services
 */
export class ObjectiveEvaluator extends Effect.Tag("effect-search/Study/ObjectiveEvaluator")<
  ObjectiveEvaluator,
  {
    /** Invokes one objective attempt without retry, caching, or result normalization. */
    readonly evaluate: <Config>(
      objective: ObjectiveFunction<Config>,
      config: Config,
      runtime: ObjectiveTrialRuntime
    ) => Effect.Effect<ObjectiveResult, unknown>
  }
>() {}

/**
 * Invokes each objective callback directly with the supplied configuration and
 * trial runtime. Layer acquisition has no requirements and cannot fail.
 *
 * @since 0.1.0
 * @category layers
 */
export const ObjectiveEvaluatorLive = Layer.succeed(ObjectiveEvaluator, {
  evaluate: (objective, config, runtime) => objective(config, runtime)
})
