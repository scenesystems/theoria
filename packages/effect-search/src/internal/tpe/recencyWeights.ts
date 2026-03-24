import { Array as Arr, Number as Num, Schema } from "effect"

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
  if (Num.lessThanOrEqualTo(nObservations, 0)) {
    return []
  }

  if (Num.lessThanOrEqualTo(nObservations, 25)) {
    return stableWeights(nObservations)
  }

  const rampCount = nObservations - 25
  const ramp = rampWeights(rampCount, nObservations)

  return [...ramp, ...stableWeights(25)]
}
