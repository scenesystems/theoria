import { Data, Schema, Tuple } from "effect"

export const CandidateRollPairSchema = Schema.Tuple(Schema.Number, Schema.Number)

export type CandidateRollPair = Schema.Schema.Type<typeof CandidateRollPairSchema>

export const makeCandidateRollPair = (
  kernelRoll: number,
  valueRoll: number
): CandidateRollPair => Tuple.make(kernelRoll, valueRoll)

export class DimensionScoreTrace<A> extends Data.Class<{
  readonly candidates: ReadonlyArray<A>
  readonly logL: ReadonlyArray<number>
  readonly logG: ReadonlyArray<number>
  readonly scores: ReadonlyArray<number>
}> {}
