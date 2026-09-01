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
 * Runs a sampler against a search space and trial context. Supports data-first
 * and data-last invocation. Algorithm validation, unsupported-space failures,
 * and exhaustion are reported as `SearchError` values.
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
 * Evaluates the sampler's checkpoint effect. Current built-in checkpoints
 * record the configuration that must match on restore; suggestion progression
 * is derived from the resumed study's trial context rather than a mutable RNG
 * cursor.
 *
 * @see {@link SamplerCheckpoint}
 * @see {@link restoreCheckpoint}
 *
 * @since 0.1.0
 * @category combinators
 */
export const checkpoint = (self: Sampler): Effect.Effect<SamplerCheckpoint, SearchError> => self.checkpoint

/**
 * Runs the sampler's optional acquisition effect, or succeeds with `void` when
 * no acquisition effect is defined.
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
 * Runs the sampler's optional finalizer, or succeeds with `void` when no
 * finalizer is defined. Unlike acquisition, release has no typed error channel.
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
 * Validates a checkpoint against a sampler's algorithm and configuration.
 * Built-in samplers reject a different algorithm tag or incompatible persisted
 * settings with `InvalidStudyConfig`. Supports data-first and data-last calls.
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
