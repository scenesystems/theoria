import { Array as Arr, Chunk, Match, Number as Num, Option, Schema } from "effect"

import { Choice } from "../../Distribution.js"

export const CandidateSetSchema = Schema.Array(Choice)

export type CandidateSet = Schema.Schema.Type<typeof CandidateSetSchema>

/** NumPy RandomState.choice uses a normalized CDF and searchsorted(side="right"). */
export const mixtureComponents = (
  weights: ReadonlyArray<number>,
  rolls: ReadonlyArray<number>
): ReadonlyArray<number> => {
  const cumulative = Arr.drop(Arr.scan(weights, 0, Num.sum), 1)
  const total = Option.getOrThrow(Arr.last(cumulative))
  const normalized = Arr.map(cumulative, (value) => Num.divideUnsafe(value, total))
  return Arr.map(
    rolls,
    (roll) => Option.getOrThrow(Arr.findFirstIndex(normalized, (edge) => Num.isGreaterThan(edge, roll)))
  )
}

/** Optuna's categorical matrix uses the first CDF entry >= roll, with its final entry set to 1. */
export const categoricalQuantiles = (
  choices: ReadonlyArray<Choice>,
  probabilities: ReadonlyArray<number>,
  rolls: ReadonlyArray<number>
): ReadonlyArray<Choice> => {
  const cumulative = Option.getOrThrow(
    Arr.modify(Arr.drop(Arr.scan(probabilities, 0, Num.sum), 1), Num.decrement(probabilities.length), () => 1)
  )
  return Arr.map(
    rolls,
    (roll) =>
      Option.getOrThrow(Arr.get(
        choices,
        Option.getOrThrow(Arr.findFirstIndex(cumulative, (edge) => Num.isGreaterThanOrEqualTo(edge, roll)))
      ))
  )
}

const sum = (valuesInput: Iterable<number>): number => {
  const values = Arr.fromIterable(valuesInput)
  return Arr.reduce(values, 0, (total, value) => Num.sum(total, value))
}

const normalizeIndex = (index: number, modulo: number): number =>
  Num.remainder(
    Match.value(Num.isLessThan(index, 0)).pipe(
      Match.when(true, () => Num.multiply(-1, index)),
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
  Match.value(Num.isGreaterThan(value, 0)).pipe(
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
  const index = Arr.findFirstIndex(cumulative, (value) => Num.isGreaterThanOrEqualTo(value, target)).pipe(
    Option.getOrElse(() => Num.multiply(-1, 1))
  )
  const fallback = Chunk.lastNonEmpty(choices)

  return Match.value(Num.isLessThan(index, 0)).pipe(
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
  return Match.value(Num.isLessThanOrEqualTo(nCandidates, 0)).pipe(
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
  return Match.value(Num.isLessThanOrEqualTo(nCandidates, 0)).pipe(
    Match.when(true, () => Arr.empty<Choice>()),
    Match.orElse(() =>
      Arr.match(choices, {
        onEmpty: () => Arr.empty<Choice>(),
        onNonEmpty: (nonEmptyChoices) => {
          const weights = Arr.makeBy(Arr.length(nonEmptyChoices), (index) =>
            positive(probabilityAt(probabilities, index)))
          const totalWeight = sum(weights)

          return Match.value(Num.isLessThanOrEqualTo(totalWeight, 0)).pipe(
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
  return Match.value(Num.isLessThanOrEqualTo(Arr.length(rolls), 0)).pipe(
    Match.when(true, () => Arr.empty<Choice>()),
    Match.orElse(() =>
      Arr.match(choices, {
        onEmpty: () => Arr.empty<Choice>(),
        onNonEmpty: (nonEmptyChoices) => {
          const weights = Arr.makeBy(Arr.length(nonEmptyChoices), (index) =>
            positive(probabilityAt(probabilities, index)))
          const totalWeight = sum(weights)

          return Match.value(Num.isLessThanOrEqualTo(totalWeight, 0)).pipe(
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
