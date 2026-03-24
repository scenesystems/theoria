/**
 * Multivariate continuous trace model — captures candidate configs, log-densities, and scores.
 *
 * @since 0.1.0
 */
import { Data } from "effect"

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
  readonly parameterNames: ReadonlyArray<string>
  readonly candidateConfigs: ReadonlyArray<unknown>
  readonly logL: ReadonlyArray<number>
  readonly logG: ReadonlyArray<number>
  readonly scores: ReadonlyArray<number>
}> {}
