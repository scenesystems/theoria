/**
 * Operations shared by built-in and custom sampler implementations.
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
 * Requests one configuration using the supplied immutable trial context.
 *
 * @remarks
 * Typed failures come directly from the sampler and can include invalid options,
 * unsupported spaces or objectives, and finite-space exhaustion. The operation
 * is available in data-first and data-last form.
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
 * Captures the state that the sampler requires to validate a resumed study.
 *
 * @remarks
 * Built-in checkpoints contain normalized configuration. Their suggestion
 * progression is reconstructed from trial context rather than an RNG cursor.
 * Custom implementations may fail with any `SearchError` allowed by their
 * checkpoint effect.
 *
 * @since 0.1.0
 * @category combinators
 */
export const checkpoint = (self: Sampler): Effect.Effect<SamplerCheckpoint, SearchError> => self.checkpoint

/**
 * Runs the sampler's acquisition effect when one is defined.
 *
 * @remarks
 * A sampler without an acquisition effect succeeds immediately.
 *
 * @since 0.1.0
 * @category combinators
 */
export const acquireLifecycle = (self: Sampler): Effect.Effect<void, SearchError> =>
  Option.fromNullable(self.acquire).pipe(
    Option.getOrElse(() => Effect.void)
  )

/**
 * Runs the sampler's release effect when one is defined.
 *
 * @remarks
 * A sampler without a release effect succeeds immediately. Release has no typed
 * error channel, though it may still defect or be interrupted.
 *
 * @since 0.1.0
 * @category combinators
 */
export const releaseLifecycle = (self: Sampler): Effect.Effect<void> =>
  Option.fromNullable(self.release).pipe(
    Option.getOrElse(() => Effect.void)
  )

/**
 * Restores a checkpoint accepted by the sampler's resume contract.
 *
 * @remarks
 * Built-in samplers fail with `InvalidStudyConfig` when the algorithm tag or
 * persisted settings differ. The operation is available in data-first and
 * data-last form.
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
