import { Array as Arr, Match, Number as Num, Option, Schema } from "effect"

import { type PrimitiveChoice, PrimitiveChoiceSchema } from "../../contracts/Distribution.js"

export const CandidateSetSchema = Schema.Array(PrimitiveChoiceSchema)

export type CandidateSet = Schema.Schema.Type<typeof CandidateSetSchema>

const ProbabilityValuesSchema = Schema.Array(Schema.Number)
type ProbabilityValues = Schema.Schema.Type<typeof ProbabilityValuesSchema>

export const CandidateRollsSchema = Schema.Array(Schema.Number)

export type CandidateRolls = Schema.Schema.Type<typeof CandidateRollsSchema>

const sum = (values: ProbabilityValues): number => Arr.reduce(values, 0, (total, value) => Num.sum(total, value))

const normalizeIndex = (index: number, modulo: number): number =>
  Num.remainder(
    Match.value(Num.lessThan(index, 0)).pipe(
      Match.when(true, () => Num.negate(index)),
      Match.orElse(() => index)
    ),
    modulo
  )

const probabilityAt = (values: ProbabilityValues, index: number): number =>
  Arr.get(values, index).pipe(Option.getOrElse(() => 0))

const positive = (value: number): number =>
  Match.value(Num.greaterThan(value, 0)).pipe(
    Match.when(true, () => value),
    Match.orElse(() => 0)
  )

const cumulativeProbabilities = (weights: ProbabilityValues): ProbabilityValues =>
  Arr.drop(Arr.scan(weights, 0, Num.sum), 1)

const pickByRoll = (
  choices: Arr.NonEmptyReadonlyArray<PrimitiveChoice>,
  cumulative: ProbabilityValues,
  totalWeight: number,
  roll: number
): PrimitiveChoice => {
  const target = Num.multiply(roll, totalWeight)
  const index = Arr.findFirstIndex(cumulative, (value) => Num.greaterThanOrEqualTo(value, target)).pipe(
    Option.getOrElse(() => -1)
  )
  const fallback = Arr.lastNonEmpty(choices)

  return Match.value(Num.lessThan(index, 0)).pipe(
    Match.when(true, () => fallback),
    Match.orElse(() => Arr.get(choices, index).pipe(Option.getOrElse(() => fallback)))
  )
}

export const sampleCategoricalCandidates = (
  choices: CandidateSet,
  nCandidates: number,
  nextIndex: () => number
): CandidateSet =>
  Match.value(Num.lessThanOrEqualTo(nCandidates, 0)).pipe(
    Match.when(true, () => Arr.empty<PrimitiveChoice>()),
    Match.orElse(() =>
      Arr.match(choices, {
        onEmpty: () => Arr.empty<PrimitiveChoice>(),
        onNonEmpty: (nonEmptyChoices) => {
          const fallback = Arr.headNonEmpty(nonEmptyChoices)

          return Arr.makeBy(nCandidates, () => {
            const index = normalizeIndex(nextIndex(), Arr.length(nonEmptyChoices))
            return Arr.get(nonEmptyChoices, index).pipe(Option.getOrElse(() => fallback))
          })
        }
      })
    )
  )

export const sampleWeightedCategoricalCandidates = (
  choices: CandidateSet,
  probabilities: ProbabilityValues,
  nCandidates: number,
  nextFloat: () => number
): CandidateSet =>
  Match.value(Num.lessThanOrEqualTo(nCandidates, 0)).pipe(
    Match.when(true, () => Arr.empty<PrimitiveChoice>()),
    Match.orElse(() =>
      Arr.match(choices, {
        onEmpty: () => Arr.empty<PrimitiveChoice>(),
        onNonEmpty: (nonEmptyChoices) => {
          const weights = Arr.makeBy(Arr.length(nonEmptyChoices), (index) =>
            positive(probabilityAt(probabilities, index)))
          const totalWeight = sum(weights)

          return Match.value(Num.lessThanOrEqualTo(totalWeight, 0)).pipe(
            Match.when(true, () =>
              sampleCategoricalCandidates(
                nonEmptyChoices,
                nCandidates,
                () =>
                  Num.round(Num.multiply(nextFloat(), Arr.length(nonEmptyChoices)), 0)
              )),
            Match.orElse(() => {
              const cumulative = cumulativeProbabilities(weights)
              return Arr.makeBy(nCandidates, () => pickByRoll(nonEmptyChoices, cumulative, totalWeight, nextFloat()))
            })
          )
        }
      })
    )
  )

export const sampleWeightedCategoricalCandidatesFromRolls = (
  choices: CandidateSet,
  probabilities: ProbabilityValues,
  rolls: CandidateRolls
): CandidateSet =>
  Match.value(Arr.isEmptyReadonlyArray(rolls)).pipe(
    Match.when(true, () => Arr.empty<PrimitiveChoice>()),
    Match.orElse(() =>
      Arr.match(choices, {
        onEmpty: () => Arr.empty<PrimitiveChoice>(),
        onNonEmpty: (nonEmptyChoices) => {
          const weights = Arr.makeBy(Arr.length(nonEmptyChoices), (index) =>
            positive(probabilityAt(probabilities, index)))
          const totalWeight = sum(weights)

          return Match.value(Num.lessThanOrEqualTo(totalWeight, 0)).pipe(
            Match.when(true, () =>
              sampleCategoricalCandidates(nonEmptyChoices, Arr.length(rolls), () => 0)),
            Match.orElse(() => {
              const cumulative = cumulativeProbabilities(weights)
              return Arr.map(rolls, (roll) => pickByRoll(nonEmptyChoices, cumulative, totalWeight, roll))
            })
          )
        }
      })
    )
  )
