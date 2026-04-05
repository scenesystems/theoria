/**
 * Core Sampler data class defining the optimization algorithm contract for suggesting, checkpointing, and restoring state.
 *
 * @since 0.1.0
 */
import type { Effect, Option } from "effect"
import { Data } from "effect"

import type { InvalidStudyConfig, SearchError } from "../Errors/index.js"
import type * as SearchSpace from "../SearchSpace/index.js"
import type { SamplerCheckpoint, SamplerKind } from "./kinds.js"
import type { PendingImputationPolicy } from "./PendingImputationPolicy.js"
import type { PreparedSuggestionState, SuggestionDiagnostics } from "./preparation.js"
import type { SuggestContext } from "./SuggestContext.js"

/**
 * The core abstraction for optimization algorithms in effect-search.
 *
 * Each algorithm (Random, Grid, TPE) implements this interface to suggest
 * configurations from a search space given trial history. The `checkpoint`
 * and `restore` fields enable snapshot persistence so a study can be paused
 * and resumed without losing algorithm-internal state.
 *
 * **Lifecycle** — `acquire`/`release` bracket algorithm-internal resources
 * (e.g. the TPE density estimator). When absent, acquisition is a no-op.
 *
 * @see {@link SearchSpace} for the dimension definitions passed to `suggest`
 * @see {@link SuggestContext} for the trial history and pending-trial context
 * @see {@link SamplerKind} for the tagged union identifying which algorithm is active
 * @see {@link checkpoint} combinator for extracting the checkpoint effect
 * @see {@link restoreCheckpoint} combinator for resuming from a persisted snapshot
 *
 * @since 0.1.0
 * @category models
 */
export class Sampler extends Data.Class<{
  readonly kind: SamplerKind
  readonly pendingImputationPolicy: PendingImputationPolicy
  readonly acquire?: Effect.Effect<void, SearchError>
  readonly release?: Effect.Effect<void>
  readonly prepareSuggestion?: (
    space: SearchSpace.SearchSpace,
    context: SuggestContext,
    previous: Option.Option<PreparedSuggestionState>
  ) => Effect.Effect<readonly [PreparedSuggestionState, SuggestionDiagnostics], SearchError>
  readonly suggestPrepared?: (
    space: SearchSpace.SearchSpace,
    context: SuggestContext,
    prepared: PreparedSuggestionState
  ) => Effect.Effect<unknown, SearchError>
  readonly suggest: (
    space: SearchSpace.SearchSpace,
    context: SuggestContext
  ) => Effect.Effect<unknown, SearchError>
  readonly checkpoint: Effect.Effect<SamplerCheckpoint, SearchError>
  readonly restore: (
    checkpoint: SamplerCheckpoint
  ) => Effect.Effect<void, InvalidStudyConfig>
}> {}
