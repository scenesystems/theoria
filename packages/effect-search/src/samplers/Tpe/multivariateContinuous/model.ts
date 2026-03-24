/**
 * Multivariate continuous trace model — captures candidate configs, log-densities, and scores.
 *
 * @since 0.1.0
 */
import { Data } from "effect"

/** @since 0.1.0 */
export class MultivariateContinuousTrace extends Data.Class<{
  readonly parameterNames: ReadonlyArray<string>
  readonly candidateConfigs: ReadonlyArray<unknown>
  readonly logL: ReadonlyArray<number>
  readonly logG: ReadonlyArray<number>
  readonly scores: ReadonlyArray<number>
}> {}
