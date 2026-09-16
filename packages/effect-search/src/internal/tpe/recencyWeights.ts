import { Array as Arr, Match, Number as Num, Schema } from "effect"

export const RecencyWeightsSchema = Schema.Array(Schema.Number)

export type RecencyWeights = Schema.Schema.Type<typeof RecencyWeightsSchema>

const stableWeights = (count: number): RecencyWeights => Arr.makeBy(count, () => 1)

const rampWeights = (count: number, total: number): RecencyWeights => {
  const start = Num.unsafeDivide(1, total)
  const denominator = Num.max(Num.decrement(count), 1)
  const step = Num.unsafeDivide(Num.subtract(1, start), denominator)

  return Arr.makeBy(count, (index) => Num.sum(start, Num.multiply(step, index)))
}

export const defaultWeights = (nObservations: number): RecencyWeights => {
  return Match.value(nObservations).pipe(
    Match.when(Num.lessThanOrEqualTo(0), () => Arr.empty<number>()),
    Match.when(Num.lessThanOrEqualTo(25), stableWeights),
    Match.orElse((count) =>
      Arr.appendAll(
        rampWeights(Num.subtract(count, 25), count),
        stableWeights(25)
      )
    )
  )
}
