/**
 * Barrel module that re-exports all search error variants and provides union schemas for error taxonomy.
 *
 * @since 0.1.0
 */
import { Predicate, Schema } from "effect"

export {
  /** @since 0.1.0 */
  SearchErrorTypeId
} from "./typeId.js"

export {
  /** @since 0.1.0 */
  GridIncompatible,
  /** @since 0.1.0 */
  InvalidSamplerConfig,
  /** @since 0.1.0 */
  SamplerExhausted,
  /** @since 0.1.0 */
  SamplerObjectiveUnsupported,
  /** @since 0.1.0 */
  SamplerSearchSpaceUnsupported
} from "./Sampler.js"
export {
  /** @since 0.1.0 */
  InvalidSearchSpace
} from "./SearchSpace.js"
export {
  /** @since 0.1.0 */
  InvalidMathInput,
  /** @since 0.1.0 */
  InvalidObjectiveReport,
  /** @since 0.1.0 */
  InvalidObjectiveValue,
  /** @since 0.1.0 */
  InvalidStudyConfig,
  /** @since 0.1.0 */
  NoSuccessfulTrials,
  /** @since 0.1.0 */
  NotImplemented,
  /** @since 0.1.0 */
  TrialError
} from "./Study.js"

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
 * @since 0.1.0
 * @category schemas
 */
export const SpaceErrorSchema = Schema.Union(InvalidSearchSpace)

/**
 * @since 0.1.0
 * @category type-level
 */
export type SpaceError = Schema.Schema.Type<typeof SpaceErrorSchema>

/**
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
 * @since 0.1.0
 * @category type-level
 */
export type SamplerError = Schema.Schema.Type<typeof SamplerErrorSchema>

/**
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
  TrialError
)

/**
 * @since 0.1.0
 * @category type-level
 */
export type StudyError = Schema.Schema.Type<typeof StudyErrorSchema>

/**
 * Root search error taxonomy covering all typed error variants.
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
  TrialError
)

/**
 * @since 0.1.0
 * @category type-level
 */
export type SearchError = Schema.Schema.Type<typeof SearchErrorSchema>

/**
 * Type guard for search error variants carrying the shared SearchErrorTypeId symbol.
 *
 * @since 0.1.0
 * @category guards
 */
export const isSearchError = (value: unknown): value is SearchError =>
  Predicate.isRecord(value) &&
  Predicate.hasProperty(value, SearchErrorTypeId) &&
  value[SearchErrorTypeId] === SearchErrorTypeId
