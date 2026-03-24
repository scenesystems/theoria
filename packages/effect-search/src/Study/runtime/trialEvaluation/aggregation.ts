/**
 * Multi-evaluation aggregation and objective result validation for trial outcomes.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Match, Number as Num, Option, Schema } from "effect"

import type { ObjectiveValue } from "../../../contracts/ObjectiveValue.js"
import { InvalidObjectiveReport, type TrialError } from "../../../Errors/index.js"
import { ObjectiveEvaluation, ObjectiveReport, ObjectiveResultSchema } from "../../objectiveEvaluator.js"
import { objectiveFailure } from "../objective.js"
import type { ObjectiveSample } from "./model.js"
import { ObjectiveAttempt } from "./model.js"

const invalidObjectiveResult = (trialNumber: number, reason: string): InvalidObjectiveReport =>
  new InvalidObjectiveReport({
    trialNumber,
    reason
  })

const isObjectiveReport = Schema.is(ObjectiveReport)

/**
 * Decodes a raw objective return value into a validated ObjectiveEvaluation, failing with InvalidObjectiveReport on invalid payloads.
 *
 * @since 0.1.0
 * @category utils
 */
export const decodeObjectiveResult = (
  trialNumber: number,
  result: unknown
): Effect.Effect<ObjectiveEvaluation, InvalidObjectiveReport> =>
  Schema.decodeUnknown(ObjectiveResultSchema)(result).pipe(
    Effect.mapError(() =>
      invalidObjectiveResult(trialNumber, "objective returned a payload that does not match ObjectiveResultSchema")
    ),
    Effect.flatMap((decoded) =>
      Match.value(decoded).pipe(
        Match.when(isObjectiveReport, (report) =>
          Option.fromNullable(report.cost).pipe(
            Option.match({
              onNone: () => Effect.succeed(new ObjectiveEvaluation({ value: report.value })),
              onSome: (cost) =>
                Match.value(Number.isFinite(cost) && Num.greaterThanOrEqualTo(cost, 0)).pipe(
                  Match.when(true, () => Effect.succeed(new ObjectiveEvaluation({ value: report.value, cost }))),
                  Match.orElse(() =>
                    Effect.fail(
                      invalidObjectiveResult(
                        trialNumber,
                        "objective report cost must be a finite number greater than or equal to zero"
                      )
                    )
                  )
                )
            })
          )),
        Match.orElse((value) => Effect.succeed(new ObjectiveEvaluation({ value })))
      )
    )
  )

const finiteNumber = (input: unknown): Option.Option<number> =>
  Match.value(input).pipe(
    Match.when(Match.number, (value) =>
      Match.value(Number.isFinite(value)).pipe(
        Match.when(true, () => Option.some(value)),
        Match.orElse(() => Option.none())
      )),
    Match.orElse(() => Option.none())
  )

const numericVectorFromValue = (value: ObjectiveValue): Option.Option<ReadonlyArray<number>> =>
  Match.value(value).pipe(
    Match.when(Match.number, (numeric) => Option.some(Arr.of(numeric))),
    Match.orElse((candidate) =>
      Match.value(Arr.isArray(candidate)).pipe(
        Match.when(false, () => Option.none()),
        Match.orElse(() =>
          Arr.reduce(candidate, Option.some(Arr.empty<number>()), (accumulator, entry) =>
            accumulator.pipe(
              Option.flatMap((current) =>
                finiteNumber(entry).pipe(
                  Option.map((resolved) => Arr.append(current, resolved))
                )
              )
            ))
        )
      )
    )
  )

const mean = (values: ReadonlyArray<number>): number =>
  Num.unsafeDivide(
    Arr.reduce(values, 0, (sum, value) => Num.sum(sum, value)),
    values.length
  )

const populationVariance = (values: ReadonlyArray<number>): number => {
  const avg = mean(values)
  return Num.unsafeDivide(
    Arr.reduce(values, 0, (sum, value) => {
      const centered = value - avg
      return Num.sum(sum, centered * centered)
    }),
    values.length
  )
}

const aggregateVectors = (
  vectors: ReadonlyArray<ReadonlyArray<number>>
): Option.Option<{ readonly value: ObjectiveValue; readonly variance: number }> => {
  const dimensionCount = Arr.get(vectors, 0).pipe(
    Option.map((vector) => vector.length),
    Option.getOrElse(() => 0)
  )

  if (dimensionCount <= 0 || !Arr.every(vectors, (vector) => vector.length === dimensionCount)) {
    return Option.none()
  }

  const means = Arr.makeBy(
    dimensionCount,
    (dimension) => mean(Arr.map(vectors, (vector) => Arr.get(vector, dimension).pipe(Option.getOrElse(() => 0))))
  )
  const variances = Arr.makeBy(
    dimensionCount,
    (dimension) =>
      populationVariance(Arr.map(vectors, (vector) => Arr.get(vector, dimension).pipe(Option.getOrElse(() => 0))))
  )
  const aggregateVariance = mean(variances)

  return Match.value(dimensionCount === 1).pipe(
    Match.when(true, () =>
      Arr.get(means, 0).pipe(
        Option.map((value) => ({ value, variance: aggregateVariance }))
      )),
    Match.orElse(() => Option.some({ value: means, variance: aggregateVariance }))
  )
}

/**
 * Computes the mean value and population variance across multiple objective samples for multi-evaluation trials.
 *
 * @since 0.1.0
 * @category utils
 */
export const aggregateObjectiveSamples = (
  trialNumber: number,
  samples: ReadonlyArray<ObjectiveSample>
): Effect.Effect<ObjectiveAttempt, TrialError> => {
  if (samples.length <= 0) {
    return Effect.fail(
      objectiveFailure(
        trialNumber,
        invalidObjectiveResult(trialNumber, "objective evaluation set must contain at least one result")
      )
    )
  }

  const vectors = Arr.reduce(
    samples,
    Option.some(Arr.empty<ReadonlyArray<number>>()),
    (accumulator, sample) =>
      accumulator.pipe(
        Option.flatMap((current) =>
          numericVectorFromValue(sample.value).pipe(
            Option.map((vector) => Arr.append(current, vector))
          )
        )
      )
  )

  return vectors.pipe(
    Option.flatMap(aggregateVectors),
    Option.match({
      onNone: () =>
        Effect.fail(
          objectiveFailure(
            trialNumber,
            invalidObjectiveResult(
              trialNumber,
              "objective re-evaluation aggregation requires all samples to be numeric with a stable dimension"
            )
          )
        ),
      onSome: ({ value, variance }) => {
        const hasCost = Arr.some(samples, (sample) => Option.isSome(Option.fromNullable(sample.cost)))
        const retryCount = Arr.reduce(samples, 0, (total, sample) => Num.sum(total, sample.retryCount))

        return Effect.succeed(
          new ObjectiveAttempt({
            value,
            retryCount,
            evaluationCount: samples.length,
            variance,
            ...Match.value(hasCost).pipe(
              Match.when(true, () => ({
                cost: Arr.reduce(
                  samples,
                  0,
                  (total, sample) => Num.sum(total, Option.fromNullable(sample.cost).pipe(Option.getOrElse(() => 0)))
                )
              })),
              Match.orElse(() => ({}))
            )
          })
        )
      }
    })
  )
}
