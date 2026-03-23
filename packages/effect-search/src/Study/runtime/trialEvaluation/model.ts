/**
 * Data models for objective evaluation attempts and sampling functions.
 *
 * @since 0.1.0
 */
import type { Effect } from "effect"
import { Data } from "effect"

import type { CacheError } from "../../../Cache/index.js"
import type { CacheResolution } from "../../../Cache/index.js"
import type { ObjectiveValue } from "../../../contracts/ObjectiveValue.js"
import type { TrialError } from "../../../Errors/index.js"
import type { StudyObjectiveCacheKey } from "../../studyObjectiveCache.js"

/**
 * Result of a single or aggregated objective evaluation carrying the value, retry count, and optional variance.
 *
 * @since 0.1.0
 * @category models
 */
export class ObjectiveAttempt extends Data.Class<{
  readonly value: ObjectiveValue
  readonly retryCount: number
  readonly evaluationCount: number
  readonly cost?: number
  readonly variance?: number
}> {}

/**
 * Single objective evaluation sample before aggregation, carrying value, retry count, and optional cost.
 *
 * @since 0.1.0
 * @category models
 */
export class ObjectiveSample extends Data.Class<{
  readonly value: ObjectiveValue
  readonly retryCount: number
  readonly cost?: number
}> {}

/**
 * @since 0.1.0
 * @category type-level
 */
export type CacheResolve = <E, Requirement>(args: {
  readonly config: StudyObjectiveCacheKey
  readonly compute: Effect.Effect<ObjectiveValue, E, Requirement>
}) => Effect.Effect<readonly [ObjectiveValue, CacheResolution], E | CacheError, Requirement>

/**
 * @since 0.1.0
 * @category type-level
 */
export type CacheResolveAsTrialError = <Requirement>(args: {
  readonly config: StudyObjectiveCacheKey
  readonly compute: Effect.Effect<ObjectiveValue, TrialError, Requirement>
}) => Effect.Effect<readonly [ObjectiveValue, CacheResolution], TrialError, Requirement>
