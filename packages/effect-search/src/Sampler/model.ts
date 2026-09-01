/**
 * Core Sampler data class defining the optimization algorithm contract for suggesting, checkpointing, and restoring state.
 *
 * @since 0.1.0
 */
import type { Effect } from "effect"
import { Data } from "effect"

import type { InvalidStudyConfig, SearchError } from "../Errors/index.js"
import type * as SearchSpace from "../SearchSpace/index.js"
import type { SamplerCheckpoint, SamplerKind } from "./kinds.js"
import type { PendingImputationPolicy } from "./PendingImputationPolicy.js"
import type { SuggestContext } from "./SuggestContext.js"

/**
 * Runtime contract implemented by sampling algorithms. `suggest` receives the
 * complete observation and reservation context; `checkpoint` and `restore`
 * define the algorithm-specific resume contract. Optional lifecycle effects
 * are run by {@link acquireLifecycle} and {@link releaseLifecycle}.
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
  /** Algorithm tag and serializable options. */
  readonly kind: SamplerKind
  /** Policy used to turn pending trials into model observations. */
  readonly pendingImputationPolicy: PendingImputationPolicy
  /** Optional lifecycle acquisition effect. */
  readonly acquire?: Effect.Effect<void, SearchError>
  /** Optional infallible lifecycle release effect. */
  readonly release?: Effect.Effect<void>
  /** Suggests a configuration or fails with an algorithm/search-space error. */
  readonly suggest: (
    space: SearchSpace.SearchSpace,
    context: SuggestContext
  ) => Effect.Effect<unknown, SearchError>
  /** Produces the algorithm-specific checkpoint. */
  readonly checkpoint: Effect.Effect<SamplerCheckpoint, SearchError>
  /** Validates and restores an algorithm-specific checkpoint. */
  readonly restore: (
    checkpoint: SamplerCheckpoint
  ) => Effect.Effect<void, InvalidStudyConfig>
}> {}
