import { Array as Arr, Chunk, Match, Number as Num, Option, Schema } from "effect"

import { Choice } from "../../Distribution.js"

export const CandidateSetSchema = Schema.Array(Choice)

export type CandidateSet = Schema.Schema.Type<typeof CandidateSetSchema>

const sum = (valuesInput: Iterable<number>): number => {
  const values = Arr.fromIterable(valuesInput)
  return Arr.reduce(values, 0, (total, value) => Num.sum(total, value))
}

const normalizeIndex = (index: number, modulo: number): number =>
  Num.remainder(
    Match.value(Num.lessThan(index, 0)).pipe(
      Match.when(true, () => Num.negate(index)),
      Match.orElse(() => index)
    ),
    modulo
  )

const valueAt = <A>(valuesInput: Iterable<A>, index: number, fallback: A): A => {
  const values = Arr.fromIterable(valuesInput)
  return Arr.get(values, index).pipe(Option.getOrElse(() => fallback))
}

const probabilityAt = (valuesInput: Iterable<number>, index: number): number => {
  const values = Arr.fromIterable(valuesInput)
  return valueAt(values, index, 0)
}

const positive = (value: number): number =>
  Match.value(Num.greaterThan(value, 0)).pipe(
    Match.when(true, () => value),
    Match.orElse(() => 0)
  )

const cumulativeProbabilities = (weightsInput: Iterable<number>) => {
  const weights = Arr.fromIterable(weightsInput)
  return Arr.drop(Arr.scan(weights, 0, Num.sum), 1)
}

const pickByRoll = (
  choices: Chunk.NonEmptyChunk<Choice>,
  cumulativeInput: Iterable<number>,
  totalWeight: number,
  roll: number
): Choice => {
  const cumulative = Arr.fromIterable(cumulativeInput)

  const target = Num.multiply(roll, totalWeight)
  const index = Arr.findFirstIndex(cumulative, (value) => Num.greaterThanOrEqualTo(value, target)).pipe(
    Option.getOrElse(() => Num.negate(1))
  )
  const fallback = Chunk.lastNonEmpty(choices)

  return Match.value(Num.lessThan(index, 0)).pipe(
    Match.when(true, () => fallback),
    Match.orElse(() => valueAt(choices, index, fallback))
  )
}

export const sampleCategoricalCandidates = (
  choicesInput: Iterable<Choice>,
  nCandidates: number,
  nextIndex: () => number
): CandidateSet => {
  const choices = Arr.fromIterable(choicesInput)
  return Match.value(Num.lessThanOrEqualTo(nCandidates, 0)).pipe(
    Match.when(true, () => Arr.empty<Choice>()),
    Match.orElse(() =>
      Arr.match(choices, {
        onEmpty: () => Arr.empty<Choice>(),
        onNonEmpty: (nonEmptyChoices) => {
          const fallback = Arr.headNonEmpty(nonEmptyChoices)

          return Arr.makeBy(nCandidates, () => {
            const index = normalizeIndex(nextIndex(), Arr.length(nonEmptyChoices))
            return valueAt(nonEmptyChoices, index, fallback)
          })
        }
      })
    )
  )
}

export const sampleWeightedCategoricalCandidates = (
  choicesInput: Iterable<Choice>,
  probabilitiesInput: Iterable<number>,
  nCandidates: number,
  nextFloat: () => number
): CandidateSet => {
  const choices = Arr.fromIterable(choicesInput)
  const probabilities = Arr.fromIterable(probabilitiesInput)
  return Match.value(Num.lessThanOrEqualTo(nCandidates, 0)).pipe(
    Match.when(true, () => Arr.empty<Choice>()),
    Match.orElse(() =>
      Arr.match(choices, {
        onEmpty: () => Arr.empty<Choice>(),
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
              return Arr.makeBy(
                nCandidates,
                () => pickByRoll(Chunk.make(...nonEmptyChoices), cumulative, totalWeight, nextFloat())
              )
            })
          )
        }
      })
    )
  )
}

export const sampleWeightedCategoricalCandidatesFromRolls = (
  choicesInput: Iterable<Choice>,
  probabilitiesInput: Iterable<number>,
  rollsInput: Iterable<number>
): CandidateSet => {
  const choices = Arr.fromIterable(choicesInput)
  const probabilities = Arr.fromIterable(probabilitiesInput)
  const rolls = Arr.fromIterable(rollsInput)
  return Match.value(Num.lessThanOrEqualTo(Arr.length(rolls), 0)).pipe(
    Match.when(true, () => Arr.empty<Choice>()),
    Match.orElse(() =>
      Arr.match(choices, {
        onEmpty: () => Arr.empty<Choice>(),
        onNonEmpty: (nonEmptyChoices) => {
          const weights = Arr.makeBy(Arr.length(nonEmptyChoices), (index) =>
            positive(probabilityAt(probabilities, index)))
          const totalWeight = sum(weights)

          return Match.value(Num.lessThanOrEqualTo(totalWeight, 0)).pipe(
            Match.when(true, () =>
              sampleCategoricalCandidates(nonEmptyChoices, Arr.length(rolls), () => 0)),
            Match.orElse(() => {
              const cumulative = cumulativeProbabilities(weights)
              return Arr.map(
                rolls,
                (roll) => pickByRoll(Chunk.make(...nonEmptyChoices), cumulative, totalWeight, roll)
              )
            })
          )
        }
      })
    )
  )
}
