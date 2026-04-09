/**
 * Dimension score trace — per-dimension candidate, log-density, and acquisition score records.
 *
 * @since 0.1.0
 */
import { Data, Schema, Tuple } from "effect"

/**
 * Two uniform draws that select a kernel component and a value within that
 * kernel.
 *
 * `kernelRoll` picks which Parzen kernel component to sample from;
 * `valueRoll` selects a position within that kernel's distribution.
 *
 * @see {@link CandidateRollPair.make} for the constructor
 * @since 0.1.0
 * @category models
 */
export class CandidateRollPair extends Schema.Class<CandidateRollPair>("CandidateRollPair")({
  kernelRoll: Schema.Number,
  valueRoll: Schema.Number
}) {}

const CandidateRollPairTuple = Schema.Tuple(Schema.Number, Schema.Number)

/**
 * Schema for a `[kernelRoll, valueRoll]` pair used to deterministically
 * sample from a Parzen estimator.
 *
 * @see {@link CandidateRollPair} for the decoded semantic value
 * @see {@link CandidateRollPair.make} for the constructor
 * @since 0.1.0
 * @category schemas
 */
export const CandidateRollPairSchema = Schema.transform(
  Schema.Union(CandidateRollPairTuple, CandidateRollPair),
  CandidateRollPair,
  {
    strict: true,
    decode: (pair) =>
      pair instanceof CandidateRollPair
        ? pair
        : CandidateRollPair.make({ kernelRoll: pair[0], valueRoll: pair[1] }),
    encode: (pair) => Tuple.make(pair.kernelRoll, pair.valueRoll)
  }
)

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
