/**
 * Dual-API combinators for invoking sampler operations such as suggest, checkpoint, restore, and lifecycle management.
 *
 * @since 0.1.0
 */
import { Effect, Option } from "effect"
import { dual } from "effect/Function"

import type { InvalidStudyConfig, SearchError } from "../Errors/index.js"
import type * as SearchSpace from "../SearchSpace/index.js"
import type { SamplerCheckpoint } from "./kinds.js"
import type { Sampler } from "./model.js"
import type { SuggestContext } from "./SuggestContext.js"

/**
 * Delegates to the sampler's `suggest` implementation to draw a candidate
 * configuration from the search space, informed by prior trial history in
 * the context. Supports both data-first `suggest(sampler, space, ctx)` and
 * data-last `pipe(sampler, suggest(space, ctx))` calling conventions.
 *
 * @see {@link Sampler}
 * @see {@link SearchSpace}
 * @see {@link SuggestContext}
 *
 * @since 0.1.0
 * @category combinators
 */
export const suggest: {
  (
    space: SearchSpace.SearchSpace,
    context: SuggestContext
  ): (self: Sampler) => Effect.Effect<unknown, SearchError>
  (
    self: Sampler,
    space: SearchSpace.SearchSpace,
    context: SuggestContext
  ): Effect.Effect<unknown, SearchError>
} = dual(
  3,
  Effect.fn("effect-search/Sampler.suggest")(
    (
      self: Sampler,
      space: SearchSpace.SearchSpace,
      context: SuggestContext
    ): Effect.Effect<unknown, SearchError> => self.suggest(space, context)
  )
)

/**
 * Extracts the sampler's current checkpoint — the minimal algorithm-specific
 * state sufficient to resume the sampler from this point. Persist the
 * returned value to enable study pause/resume without re-running trials.
 *
 * @see {@link SamplerCheckpoint}
 * @see {@link restoreCheckpoint}
 *
 * @since 0.1.0
 * @category combinators
 */
export const checkpoint = (self: Sampler): Effect.Effect<SamplerCheckpoint, SearchError> => self.checkpoint

/**
 * Acquires algorithm-internal resources (e.g. density estimators, caches).
 * Returns `Effect.void` when the sampler has no `acquire` hook, so callers
 * can invoke this unconditionally without checking for its presence.
 *
 * @see {@link Sampler}
 * @see {@link releaseLifecycle}
 *
 * @since 0.1.0
 * @category combinators
 */
export const acquireLifecycle = (self: Sampler): Effect.Effect<void, SearchError> =>
  Option.fromNullable(self.acquire).pipe(
    Option.getOrElse(() => Effect.void)
  )

/**
 * Releases algorithm-internal resources previously acquired via
 * {@link acquireLifecycle}. Returns `Effect.void` when the sampler has no
 * `release` hook, so callers can invoke this unconditionally.
 *
 * @see {@link Sampler}
 * @see {@link acquireLifecycle}
 *
 * @since 0.1.0
 * @category combinators
 */
export const releaseLifecycle = (self: Sampler): Effect.Effect<void> =>
  Option.fromNullable(self.release).pipe(
    Option.getOrElse(() => Effect.void)
  )

/**
 * Restores sampler-internal state from a previously persisted checkpoint,
 * enabling study resume without re-running completed trials. Fails with
 * `InvalidStudyConfig` if the checkpoint tag does not match the sampler's
 * algorithm. Supports both data-first and data-last calling conventions.
 *
 * @see {@link SamplerCheckpoint}
 * @see {@link checkpoint}
 * @see {@link Sampler}
 *
 * @since 0.1.0
 * @category combinators
 */
export const restoreCheckpoint: {
  (
    checkpoint: SamplerCheckpoint
  ): (self: Sampler) => Effect.Effect<void, InvalidStudyConfig>
  (
    self: Sampler,
    checkpoint: SamplerCheckpoint
  ): Effect.Effect<void, InvalidStudyConfig>
} = dual(
  2,
  (
    self: Sampler,
    checkpoint: SamplerCheckpoint
  ): Effect.Effect<void, InvalidStudyConfig> => self.restore(checkpoint)
)
