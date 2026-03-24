/**
 * Dimension score trace — per-dimension candidate, log-density, and acquisition score records.
 *
 * @since 0.1.0
 */
import { Data, Schema, Tuple } from "effect"

/** @since 0.1.0 */
export const CandidateRollPairSchema = Schema.Tuple(Schema.Number, Schema.Number)

/** @since 0.1.0 */
export type CandidateRollPair = Schema.Schema.Type<typeof CandidateRollPairSchema>

/** @since 0.1.0 */
export const makeCandidateRollPair = (
  kernelRoll: number,
  valueRoll: number
): CandidateRollPair => Tuple.make(kernelRoll, valueRoll)

/** @since 0.1.0 */
export class DimensionScoreTrace<A> extends Data.Class<{
  readonly candidates: ReadonlyArray<A>
  readonly logL: ReadonlyArray<number>
  readonly logG: ReadonlyArray<number>
  readonly scores: ReadonlyArray<number>
}> {}
