import { isFinite, logStrict } from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Boolean as Bool, Data, Number as Num, Option, Schema } from "effect"

export const ExpectedImprovementScoreSchema = Schema.Number

export type ExpectedImprovementScore = Schema.Schema.Type<typeof ExpectedImprovementScoreSchema>

export const expectedImprovementScore = (
  logL: number,
  logG: number
): ExpectedImprovementScore => Num.subtract(logL, logG)

const finitePositiveCost = (estimatedCost: number): boolean =>
  Bool.and(isFinite(estimatedCost), Num.greaterThan(estimatedCost, 0))

export const scoreWithEstimatedCost = (
  score: ExpectedImprovementScore,
  estimatedCost: Option.Option<number>
): ExpectedImprovementScore =>
  estimatedCost.pipe(
    Option.filter(finitePositiveCost),
    Option.match({
      onNone: () => score,
      onSome: (cost) => Num.subtract(score, logStrict(cost))
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

const isNonNaN = Schema.is(Schema.NonNaN)

export const argmax = (scores: Iterable<ExpectedImprovementScore>): number =>
  Arr.reduce(
    Arr.fromIterable(scores),
    Option.none<ArgmaxCandidate>(),
    (currentBest, candidateScore, index) =>
      Bool.match(isNonNaN(candidateScore), {
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
