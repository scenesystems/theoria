/**
 * Objective function evaluation service and structured objective report model.
 *
 * @since 0.1.0
 */
import { Data, Effect, Layer, Predicate, Schema } from "effect"

import { type ObjectiveValue, ObjectiveValueSchema } from "../contracts/ObjectiveValue.js"
import type { ObjectiveTrialRuntime } from "./runtime/pruning.js"

/**
 * Structured objective report with optional cost metadata.
 *
 * @since 0.1.0
 * @category models
 */
export class ObjectiveReport extends Schema.Class<ObjectiveReport>("effect-search/Study/ObjectiveReport")({
  value: ObjectiveValueSchema,
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
  readonly value: ObjectiveValue
  readonly cost?: number
}> {}

/**
 * User-provided objective callback receiving a config and runtime, returning an ObjectiveResult.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ObjectiveFunction<Config = unknown> = (
  config: Config,
  runtime: ObjectiveTrialRuntime
) => Effect.Effect<ObjectiveResult, unknown>

/**
 * Runtime schema that validates a value is a function, used for objective function declarations in plan schemas.
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
 * @since 0.1.0
 * @category services
 */
export class ObjectiveEvaluator extends Effect.Tag("effect-search/Study/ObjectiveEvaluator")<
  ObjectiveEvaluator,
  {
    readonly evaluate: <Config>(
      objective: ObjectiveFunction<Config>,
      config: Config,
      runtime: ObjectiveTrialRuntime
    ) => Effect.Effect<ObjectiveResult, unknown>
  }
>() {}

/**
 * @since 0.1.0
 * @category layers
 */
export const ObjectiveEvaluatorLive = Layer.succeed(ObjectiveEvaluator, {
  evaluate: (objective, config, runtime) => objective(config, runtime)
})
