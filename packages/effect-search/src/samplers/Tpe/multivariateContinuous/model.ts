/**
 * Multivariate continuous trace model — captures candidate configs, log-densities, and scores.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

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
export class MultivariateContinuousTrace extends Schema.Class<MultivariateContinuousTrace>(
  "effect-search/MultivariateContinuousTrace"
)({
  parameterNames: Schema.Array(Schema.String),
  candidateConfigs: Schema.Array(Schema.Unknown),
  logL: Schema.Array(Schema.Number),
  logG: Schema.Array(Schema.Number),
  scores: Schema.Array(Schema.Number)
}) {}
