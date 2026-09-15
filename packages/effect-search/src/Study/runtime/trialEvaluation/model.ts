/**
 * Data models for objective evaluation attempts and sampling functions.
 *
 * @since 0.1.0
 */
import type { Effect, Schema } from "effect"
import { Data } from "effect"

import type { SchemaCacheResult } from "../../../Cache/index.js"
import type { ObjectiveValue } from "../../../contracts/ObjectiveValue.js"
import type { ArtifactStorageError, TrialError } from "../../../Errors/index.js"
import type { StudyObjectiveCacheApi, StudyObjectiveCacheRequest } from "../../studyObjectiveCache.js"

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
export type CacheResolve = StudyObjectiveCacheApi["resolve"]

/**
 * @since 0.1.0
 * @category type-level
 */
export type CacheResolveForTrial<SpaceSchema extends Schema.Schema.AnyNoContext> = <R>(
  request: StudyObjectiveCacheRequest<
    Schema.Schema.Type<SpaceSchema>,
    Schema.Schema.Encoded<SpaceSchema>,
    TrialError | ArtifactStorageError,
    R
  >
) => Effect.Effect<SchemaCacheResult<ObjectiveValue>, TrialError | ArtifactStorageError, R>
