/**
 * Dimension score trace — per-dimension candidate, log-density, and acquisition score records.
 *
 * @since 0.1.0
 */
import { Data, Schema, Tuple } from "effect"

/**
 * Schema for a `[kernelRoll, valueRoll]` pair used to deterministically
 * sample from a Parzen estimator.
 *
 * @see {@link CandidateRollPair} for the inferred TypeScript type
 * @see {@link makeCandidateRollPair} for the constructor
 * @since 0.1.0
 * @category schemas
 */
export const CandidateRollPairSchema = Schema.Tuple(Schema.Number, Schema.Number)

/**
 * A tuple of two uniform draws that select a kernel component and a value
 * within that kernel.
 *
 * The first element picks which Parzen kernel component to sample from; the
 * second element selects a position within that kernel's distribution.
 *
 * @see {@link CandidateRollPairSchema} for the serializable schema
 * @see {@link makeCandidateRollPair} for the constructor
 * @since 0.1.0
 * @category models
 */
export type CandidateRollPair = Schema.Schema.Type<typeof CandidateRollPairSchema>

/**
 * Constructs a {@link CandidateRollPair} from a kernel index roll and a
 * within-kernel value roll.
 *
 * @see {@link CandidateRollPair} for the output type
 * @since 0.1.0
 * @category constructors
 */
export const makeCandidateRollPair = (
  kernelRoll: number,
  valueRoll: number
): CandidateRollPair => Tuple.make(kernelRoll, valueRoll)

/**
 * Per-dimension trace of candidate values, their log-densities under l(x)
 * and g(x), and acquisition scores.
 *
 * Provides full observability into the TPE sampling step for diagnostics,
 * debugging, and deterministic replay.
 *
 * @see {@link CandidateRollPair} for the randomness inputs that produce these traces
 * @since 0.1.0
 * @category models
 */
export class DimensionScoreTrace<A> extends Data.Class<{
  readonly candidates: ReadonlyArray<A>
  readonly logL: ReadonlyArray<number>
  readonly logG: ReadonlyArray<number>
  readonly scores: ReadonlyArray<number>
}> {}
