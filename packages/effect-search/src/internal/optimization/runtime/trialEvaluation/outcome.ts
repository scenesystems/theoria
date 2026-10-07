/**
 * Data models for optimization objective attempts and sampling functions.
 *
 * @since 0.1.0
 */
import type * as PersistenceError from "@scenesystems/effect-study/PersistenceError"
import { type Effect, Schema } from "effect"

import type * as Cache from "../../../../Cache.js"
import { Value } from "../../../../Objective.js"
import type { Request, Service } from "../../../../ObjectiveCache.js"
import type { TrialError } from "../../../../SearchError.js"

/**
 * Result of a single or aggregated objective evaluation carrying the value, retry count, and optional variance.
 *
 * @since 0.1.0
 * @category models
 */
export class ObjectiveAttempt extends Schema.Class<ObjectiveAttempt>(
  "@scenesystems/effect-search/internal/optimization/runtime/trialEvaluation/outcome/ObjectiveAttempt"
)({
  value: Value,
  retryCount: Schema.Finite,
  evaluationCount: Schema.Finite,
  cost: Schema.optional(Schema.Finite),
  variance: Schema.optional(Schema.Finite)
}) {}

/**
 * Single objective evaluation sample before aggregation, carrying value, retry count, and optional cost.
 *
 * @since 0.1.0
 * @category models
 */
export class ObjectiveSample extends Schema.Class<ObjectiveSample>(
  "@scenesystems/effect-search/internal/optimization/runtime/trialEvaluation/outcome/ObjectiveSample"
)({
  value: Value,
  retryCount: Schema.Finite,
  cost: Schema.optional(Schema.Finite)
}) {}

/**
 * @since 0.1.0
 * @category type-level
 */
export type CacheResolve = Service["resolve"]

/**
 * @since 0.1.0
 * @category type-level
 */
export type CacheResolveForTrial<SpaceSchema extends Schema.Constraint> = <R>(
  request: Request<
    SpaceSchema["Type"],
    SpaceSchema["Encoded"],
    TrialError | PersistenceError.Failure,
    R
  >
) => Effect.Effect<Cache.Result<Value>, TrialError | PersistenceError.Failure, R>
