import { Array as Arr, Data, Match, Number as Num, Option, Schema } from "effect"
import { logStrict } from "effect-math/Numeric"

export const ExpectedImprovementScoreSchema = Schema.Number

export type ExpectedImprovementScore = Schema.Schema.Type<typeof ExpectedImprovementScoreSchema>

export const expectedImprovementScore = (
  logL: number,
  logG: number
): ExpectedImprovementScore => logL - logG

const finitePositiveCost = (estimatedCost: number): boolean =>
  Number.isFinite(estimatedCost) && Num.greaterThan(estimatedCost, 0)

export const scoreWithEstimatedCost = (
  score: ExpectedImprovementScore,
  estimatedCost: Option.Option<number>
): ExpectedImprovementScore =>
  estimatedCost.pipe(
    Option.filter(finitePositiveCost),
    Option.match({
      onNone: () => score,
      onSome: (cost) => score - logStrict(cost)
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

export const sumLogDensities = (values: ReadonlyArray<number>): number =>
  Arr.reduce(values, 0, (sum, value) => Num.sum(sum, value))

export const jointExpectedImprovementScore = (
  logLContributions: ReadonlyArray<number>,
  logGContributions: ReadonlyArray<number>
): ExpectedImprovementScore =>
  expectedImprovementScore(sumLogDensities(logLContributions), sumLogDensities(logGContributions))

export const costWeightedJointExpectedImprovementScore = (
  logLContributions: ReadonlyArray<number>,
  logGContributions: ReadonlyArray<number>,
  estimatedCost: Option.Option<number>
): ExpectedImprovementScore =>
  scoreWithEstimatedCost(
    jointExpectedImprovementScore(logLContributions, logGContributions),
    estimatedCost
  )

class ArgmaxCandidate extends Data.Class<{
  readonly index: number
  readonly score: number
}> {}

const initialArgmaxCandidate = new ArgmaxCandidate({
  index: 0,
  score: Number.NEGATIVE_INFINITY
})

export const argmax = (scores: ReadonlyArray<ExpectedImprovementScore>): number =>
  Arr.reduce(
    scores,
    initialArgmaxCandidate,
    (currentBest, candidateScore, index) =>
      Match.value(Num.greaterThan(candidateScore, currentBest.score)).pipe(
        Match.when(true, () => new ArgmaxCandidate({ index, score: candidateScore })),
        Match.orElse(() => currentBest)
      )
  ).index
