/**
 * Expected failures returned by search-space, sampler, and study operations.
 *
 * @remarks
 * Match individual tags in an Effect failure channel. The focused schemas decode
 * failures owned by one subsystem; `SearchErrorSchema` accepts every public search error.
 *
 * @since 0.1.0
 * @module
 */
import { Predicate, Schema } from "effect"

export { SearchErrorTypeId } from "./typeId.js"

export { ArtifactStorageError } from "./Artifact.js"
export {
  GridIncompatible,
  InvalidSamplerConfig,
  SamplerExhausted,
  SamplerObjectiveUnsupported,
  SamplerSearchSpaceUnsupported
} from "./Sampler.js"
export { InvalidSearchSpace } from "./SearchSpace.js"
export {
  InvalidMathInput,
  InvalidObjectiveReport,
  InvalidObjectiveValue,
  InvalidStudyConfig,
  NoSuccessfulTrials,
  NotImplemented,
  TrialError
} from "./Study.js"

import { ArtifactStorageError } from "./Artifact.js"
import {
  GridIncompatible,
  InvalidSamplerConfig,
  SamplerExhausted,
  SamplerObjectiveUnsupported,
  SamplerSearchSpaceUnsupported
} from "./Sampler.js"
import { InvalidSearchSpace } from "./SearchSpace.js"
import {
  InvalidMathInput,
  InvalidObjectiveReport,
  InvalidObjectiveValue,
  InvalidStudyConfig,
  NoSuccessfulTrials,
  NotImplemented,
  TrialError
} from "./Study.js"
import { SearchErrorTypeId } from "./typeId.js"

/**
 * Decodes failures at the search-space declaration and traversal boundary.
 *
 * @since 0.1.0
 * @category schemas
 */
export const SpaceErrorSchema = Schema.Union(InvalidSearchSpace)

/**
 * Expected failure owned by search-space declaration or traversal.
 *
 * @since 0.1.0
 * @category type-level
 */
export type SpaceError = Schema.Schema.Type<typeof SpaceErrorSchema>

/**
 * Decodes sampler configuration, compatibility, and exhaustion failures.
 *
 * @since 0.1.0
 * @category schemas
 */
export const SamplerErrorSchema = Schema.Union(
  InvalidSamplerConfig,
  SamplerExhausted,
  GridIncompatible,
  SamplerSearchSpaceUnsupported,
  SamplerObjectiveUnsupported
)

/**
 * Expected failure from sampler configuration, compatibility, or finite exhaustion.
 *
 * @since 0.1.0
 * @category type-level
 */
export type SamplerError = Schema.Schema.Type<typeof SamplerErrorSchema>

/**
 * Decodes failures owned by study orchestration, objective reporting, trial
 * execution and artifact persistence; search-space and sampler failures remain
 * outside this union.
 *
 * @since 0.1.0
 * @category schemas
 */
export const StudyErrorSchema = Schema.Union(
  InvalidStudyConfig,
  InvalidObjectiveValue,
  InvalidObjectiveReport,
  NoSuccessfulTrials,
  InvalidMathInput,
  NotImplemented,
  TrialError,
  ArtifactStorageError
)

/**
 * Expected failure owned by study setup, execution, reporting, or restore.
 *
 * @since 0.1.0
 * @category type-level
 */
export type StudyError = Schema.Schema.Type<typeof StudyErrorSchema>

/**
 * Decodes every package-owned search-space, sampler, and study error variant.
 *
 * @since 0.1.0
 * @category schemas
 */
export const SearchErrorSchema = Schema.Union(
  InvalidSearchSpace,
  InvalidSamplerConfig,
  SamplerExhausted,
  InvalidStudyConfig,
  GridIncompatible,
  SamplerSearchSpaceUnsupported,
  SamplerObjectiveUnsupported,
  InvalidObjectiveValue,
  InvalidObjectiveReport,
  NoSuccessfulTrials,
  InvalidMathInput,
  NotImplemented,
  TrialError,
  ArtifactStorageError
)

/**
 * Package-wide expected failure union for callers that do not preserve subsystem boundaries.
 *
 * @since 0.1.0
 * @category type-level
 */
export type SearchError = Schema.Schema.Type<typeof SearchErrorSchema>

/**
 * Reports whether a record carries this module instance's {@link SearchErrorTypeId} value.
 * The check does not decode fields and is not a substitute for {@link SearchErrorSchema}
 * at an untrusted boundary.
 *
 * @since 0.1.0
 * @category guards
 */
export const isSearchError = (value: unknown): value is SearchError =>
  Predicate.isRecord(value) &&
  Predicate.hasProperty(value, SearchErrorTypeId) &&
  value[SearchErrorTypeId] === SearchErrorTypeId
