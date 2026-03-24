import { Array as Arr, Match, Number as Num, Option, Schema } from "effect"

import { type PrimitiveChoice, PrimitiveChoiceSchema } from "../../contracts/Distribution.js"

export const CandidateSetSchema = Schema.Array(PrimitiveChoiceSchema)

export type CandidateSet = Schema.Schema.Type<typeof CandidateSetSchema>

const sum = (values: ReadonlyArray<number>): number => Arr.reduce(values, 0, (total, value) => Num.sum(total, value))

const normalizeIndex = (index: number, modulo: number): number =>
  Match.value(Num.lessThan(index, 0)).pipe(
    Match.when(true, () => Num.multiply(index, -1)),
    Match.orElse(() => index)
  ) % modulo

const valueAt = <A>(values: ReadonlyArray<A>, index: number, fallback: A): A =>
  Arr.get(values, index).pipe(Option.getOrElse(() => fallback))

const probabilityAt = (values: ReadonlyArray<number>, index: number): number => valueAt(values, index, 0)

const positive = (value: number): number =>
  Match.value(Num.greaterThan(value, 0)).pipe(
    Match.when(true, () => value),
    Match.orElse(() => 0)
  )

const cumulativeProbabilities = (weights: ReadonlyArray<number>): ReadonlyArray<number> =>
  Arr.reduce(weights, Arr.empty<number>(), (acc, weight) => {
    const previousTotal = valueAt(acc, acc.length - 1, 0)
    return Arr.append(acc, Num.sum(previousTotal, weight))
  })

const fallbackChoice = (choices: ReadonlyArray<PrimitiveChoice>): PrimitiveChoice =>
  valueAt(choices, choices.length - 1, null)

const firstChoice = (choices: ReadonlyArray<PrimitiveChoice>): PrimitiveChoice => valueAt(choices, 0, null)

const pickByRoll = (
  choices: ReadonlyArray<PrimitiveChoice>,
  cumulative: ReadonlyArray<number>,
  totalWeight: number,
  roll: number
): PrimitiveChoice => {
  const target = Num.multiply(roll, totalWeight)
  const index = Arr.findFirstIndex(cumulative, (value) => Num.greaterThanOrEqualTo(value, target)).pipe(
    Option.getOrElse(() => -1)
  )
  const fallback = fallbackChoice(choices)

  return Match.value(Num.lessThan(index, 0)).pipe(
    Match.when(true, () => fallback),
    Match.orElse(() => valueAt(choices, index, fallback))
  )
}

export const sampleCategoricalCandidates = (
  choices: ReadonlyArray<PrimitiveChoice>,
  nCandidates: number,
  nextIndex: () => number
): CandidateSet =>
  Match.value(choices.length <= 0 || nCandidates <= 0).pipe(
    Match.when(true, () => Arr.empty<PrimitiveChoice>()),
    Match.orElse(() => {
      const fallback = firstChoice(choices)

      return Arr.makeBy(nCandidates, () => {
        const index = normalizeIndex(nextIndex(), choices.length)
        return valueAt(choices, index, fallback)
      })
    })
  )

export const sampleWeightedCategoricalCandidates = (
  choices: ReadonlyArray<PrimitiveChoice>,
  probabilities: ReadonlyArray<number>,
  nCandidates: number,
  nextFloat: () => number
): CandidateSet =>
  Match.value(choices.length <= 0 || nCandidates <= 0).pipe(
    Match.when(true, () => Arr.empty<PrimitiveChoice>()),
    Match.orElse(() => {
      const weights = Arr.makeBy(choices.length, (index) => positive(probabilityAt(probabilities, index)))
      const totalWeight = sum(weights)

      return Match.value(Num.lessThanOrEqualTo(totalWeight, 0)).pipe(
        Match.when(true, () =>
          sampleCategoricalCandidates(choices, nCandidates, () => Num.round(nextFloat() * choices.length, 0))),
        Match.orElse(() => {
          const cumulative = cumulativeProbabilities(weights)
          return Arr.makeBy(nCandidates, () =>
            pickByRoll(choices, cumulative, totalWeight, nextFloat()))
        })
      )
    })
  )

export const sampleWeightedCategoricalCandidatesFromRolls = (
  choices: ReadonlyArray<PrimitiveChoice>,
  probabilities: ReadonlyArray<number>,
  rolls: ReadonlyArray<number>
): CandidateSet =>
  Match.value(choices.length <= 0 || rolls.length <= 0).pipe(
    Match.when(true, () => Arr.empty<PrimitiveChoice>()),
    Match.orElse(() => {
      const weights = Arr.makeBy(choices.length, (index) => positive(probabilityAt(probabilities, index)))
      const totalWeight = sum(weights)

      return Match.value(Num.lessThanOrEqualTo(totalWeight, 0)).pipe(
        Match.when(true, () => sampleCategoricalCandidates(choices, rolls.length, () => 0)),
        Match.orElse(() => {
          const cumulative = cumulativeProbabilities(weights)
          return Arr.map(rolls, (roll) => pickByRoll(choices, cumulative, totalWeight, roll))
        })
      )
    })
  )
