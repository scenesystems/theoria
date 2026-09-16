/**
 * Multivariate continuous trace model — captures candidate configs, log-densities, and scores.
 *
 * @since 0.1.0
 */
import { type Chunk, Data } from "effect"

import type { Vector } from "../../../Objective.js"

/**
 * Immutable trace capturing the multivariate continuous TPE sampling step —
 * stores parameter names, candidate configs, below/above log-densities, and
 * acquisition scores for diagnostics and selection.
 *
 * Provides full observability into the correlated continuous sampling path,
 * enabling diagnostic visualization and deterministic replay.
 *
 * @see {@link multivariateContinuousCandidateTrace} for the producer
 * @since 0.1.0
 * @category models
 */
export class MultivariateContinuousTrace extends Data.Class<{
  readonly parameterNames: Chunk.Chunk<string>
  readonly candidateConfigs: Chunk.Chunk<unknown>
  readonly logL: Vector
  readonly logG: Vector
  readonly scores: Vector
}> {}
