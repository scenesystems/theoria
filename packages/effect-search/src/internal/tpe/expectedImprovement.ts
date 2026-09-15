import { Array as Arr, Boolean, Number as Num, Option, Schema } from "effect"

import * as Float64 from "../float64.js"

export const ExpectedImprovementScoreSchema = Schema.Number

export type ExpectedImprovementScore = Schema.Schema.Type<typeof ExpectedImprovementScoreSchema>

type Scores = Schema.Array$<typeof ExpectedImprovementScoreSchema>["Type"]

export const expectedImprovementScore = (
  logL: number,
  logG: number
): ExpectedImprovementScore => Num.subtract(logL, logG)

const finitePositiveCost = (estimatedCost: number): boolean =>
  Boolean.and(Schema.is(Schema.Finite)(estimatedCost), Num.greaterThan(estimatedCost, 0))

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

export const sumLogDensities = (values: Scores): number => Num.sumAll(values)

export const jointExpectedImprovementScore = (
  logLContributions: Scores,
  logGContributions: Scores
): ExpectedImprovementScore =>
  expectedImprovementScore(sumLogDensities(logLContributions), sumLogDensities(logGContributions))

export const costWeightedJointExpectedImprovementScore = (
  logLContributions: Scores,
  logGContributions: Scores,
  estimatedCost: Option.Option<number>
): ExpectedImprovementScore =>
  scoreWithEstimatedCost(
    jointExpectedImprovementScore(logLContributions, logGContributions),
    estimatedCost
  )

class ArgmaxCandidate extends Schema.Class<ArgmaxCandidate>("effect-search/ArgmaxCandidate")({
  index: Schema.Number,
  score: ExpectedImprovementScoreSchema
}) {}

const isNonNaN = Schema.is(Schema.NonNaN)

export const argmax = (scores: Scores): number =>
  Arr.reduce(
    scores,
    Option.none<ArgmaxCandidate>(),
    (currentBest, candidateScore, index) =>
      Boolean.match(isNonNaN(candidateScore), {
        onFalse: () => currentBest,
        onTrue: () =>
          currentBest.pipe(
            Option.filter((current) => Num.greaterThanOrEqualTo(current.score, candidateScore)),
            Option.orElse(() => Option.some(new ArgmaxCandidate({ index, score: candidateScore })))
          )
      })
  ).pipe(
    Option.map((candidate) => candidate.index),
    Option.getOrElse(() => 0)
  )
