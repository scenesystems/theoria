import { Array as Arr, Boolean as Bool, Data, Match, Number as Num, Option, Schema } from "effect"

import * as Float64 from "../float64.js"

export const ExpectedImprovementScoreSchema = Schema.Number

export type ExpectedImprovementScore = Schema.Schema.Type<typeof ExpectedImprovementScoreSchema>

export const expectedImprovementScore = (
  logL: number,
  logG: number
): ExpectedImprovementScore => Num.subtract(logL, logG)

const finitePositiveCost = (estimatedCost: number): boolean =>
  Bool.and(Number.isFinite(estimatedCost), Num.greaterThan(estimatedCost, 0))

export const scoreWithEstimatedCost = (
  score: ExpectedImprovementScore,
  estimatedCost: Option.Option<number>
): ExpectedImprovementScore =>
  estimatedCost.pipe(
    Option.filter(finitePositiveCost),
    Option.match({
      onNone: () => score,
      onSome: (cost) => Num.subtract(score, Float64.log(cost))
    })
  )

export const costWeightedExpectedImprovementScore = (
  logL: number,
  logG: number,
  estimatedCost: Option.Option<number>
): ExpectedImprovementScore =>
  scoreWithEstimatedCost(
    expectedImprovementScore(logL, logG),
    estimatedCost
  )

export const sumLogDensities = (values: Iterable<number>): number =>
  Arr.reduce(Arr.fromIterable(values), 0, (sum, value) => Num.sum(sum, value))

export const jointExpectedImprovementScore = (
  logLContributionsInput: Iterable<number>,
  logGContributionsInput: Iterable<number>
): ExpectedImprovementScore => {
  const logLContributions = Arr.fromIterable(logLContributionsInput)
  const logGContributions = Arr.fromIterable(logGContributionsInput)
  return expectedImprovementScore(sumLogDensities(logLContributions), sumLogDensities(logGContributions))
}

export const costWeightedJointExpectedImprovementScore = (
  logLContributionsInput: Iterable<number>,
  logGContributionsInput: Iterable<number>,
  estimatedCost: Option.Option<number>
): ExpectedImprovementScore => {
  const logLContributions = Arr.fromIterable(logLContributionsInput)
  const logGContributions = Arr.fromIterable(logGContributionsInput)
  return scoreWithEstimatedCost(
    jointExpectedImprovementScore(logLContributions, logGContributions),
    estimatedCost
  )
}

class ArgmaxCandidate extends Data.Class<{
  readonly index: number
  readonly score: number
}> {}

const initialArgmaxCandidate = new ArgmaxCandidate({
  index: 0,
  score: Number.NEGATIVE_INFINITY
})

export const argmax = (scores: Iterable<ExpectedImprovementScore>): number =>
  Arr.reduce(
    Arr.fromIterable(scores),
    initialArgmaxCandidate,
    (currentBest, candidateScore, index) =>
      Match.value(Num.greaterThan(candidateScore, currentBest.score)).pipe(
        Match.when(true, () => new ArgmaxCandidate({ index, score: candidateScore })),
        Match.orElse(() => currentBest)
      )
  ).index
