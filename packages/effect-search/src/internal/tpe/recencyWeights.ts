import { Array as Arr, Match, Number as Num, Schema } from "effect"

export const RecencyWeightsSchema = Schema.Array(Schema.Finite)

export type RecencyWeights = Schema.Schema.Type<typeof RecencyWeightsSchema>

const stableWeights = (count: number): RecencyWeights => Arr.makeBy(count, () => 1)

const rampWeights = (count: number, total: number): RecencyWeights => {
  const start = Num.divideUnsafe(1, total)
  const denominator = Num.max(Num.decrement(count), 1)
  const step = Num.divideUnsafe(Num.subtract(1, start), denominator)

  return Arr.makeBy(count, (index) => Num.sum(start, Num.multiply(step, index)))
}

export const defaultWeights = (nObservations: number): RecencyWeights => {
  return Match.value(nObservations).pipe(
    Match.when(Num.isLessThanOrEqualTo(0), () => Arr.empty<number>()),
    Match.when(Num.isLessThanOrEqualTo(25), stableWeights),
    Match.orElse((count) =>
      Arr.appendAll(
        rampWeights(Num.subtract(count, 25), count),
        stableWeights(25)
      )
    )
  )
}
