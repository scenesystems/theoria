/**
 * Runtime contract for proposing configurations and validating sampler resumes.
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
 * Couples a suggestion operation with serializable algorithm identity,
 * checkpoint validation, pending-trial imputation, and optional lifecycle
 * effects. The Study runtime invokes lifecycle effects; direct callers must use
 * {@link acquireLifecycle} and {@link releaseLifecycle} themselves.
 *
 * @since 0.1.0
 * @category models
 */
export class Sampler extends Data.Class<{
  /** Algorithm tag and options retained in snapshots and diagnostics. */
  readonly kind: SamplerKind
  /** Converts pending trials into observations before model-based suggestion. */
  readonly pendingImputationPolicy: PendingImputationPolicy
  /** Runs before the sampler is used and may fail with a typed search error. */
  readonly acquire?: Effect.Effect<void, SearchError>
  /** Runs when sampler use ends; failures can occur only as defects or interruption. */
  readonly release?: Effect.Effect<void>
  /** Proposes one configuration from the supplied space and immutable trial context. */
  readonly suggest: (
    space: SearchSpace.SearchSpace,
    context: SuggestContext
  ) => Effect.Effect<unknown, SearchError>
  /** Captures the algorithm state required to reject an incompatible resume. */
  readonly checkpoint: Effect.Effect<SamplerCheckpoint, SearchError>
  /** Restores compatible state or reports the checkpoint mismatch. */
  readonly restore: (
    checkpoint: SamplerCheckpoint
  ) => Effect.Effect<void, InvalidStudyConfig>
}> {}
