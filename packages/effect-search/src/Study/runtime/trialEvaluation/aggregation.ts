/**
 * Multi-evaluation aggregation and objective result validation for trial outcomes.
 *
 * @since 0.1.0
 */
import { Array as Arr, Boolean as Bool, Effect, Match, Number as Num, Option, Schema } from "effect"

import { type ObjectiveValue, ObjectiveValueSchema, ObjectiveVectorSchema } from "../../../contracts/ObjectiveValue.js"
import { InvalidObjectiveReport, type TrialError } from "../../../Errors/index.js"
import { ObjectiveEvaluation, ObjectiveReport, ObjectiveResultSchema } from "../../objectiveEvaluator.js"
import { objectiveFailure } from "../objective.js"
import { ObjectiveAttempt, ObjectiveSample } from "./model.js"

const ObjectiveSamples = Schema.Array(ObjectiveSample)
const ObjectiveVectors = Schema.Array(ObjectiveVectorSchema)
const ObjectiveAggregate = Schema.Struct({ value: ObjectiveValueSchema, variance: Schema.Number })
const validCost = Schema.is(Schema.JsonNumber.pipe(Schema.nonNegative()))

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
                Bool.match(validCost(cost), {
                  onTrue: () => Effect.succeed(new ObjectiveEvaluation({ value: report.value, cost })),
                  onFalse: () =>
                    Effect.fail(
                      invalidObjectiveResult(
                        trialNumber,
                        "objective report cost must be a finite number greater than or equal to zero"
                      )
                    )
                })
            })
          )),
        Match.when(Schema.is(ObjectiveValueSchema), (value) => Effect.succeed(new ObjectiveEvaluation({ value }))),
        Match.exhaustive
      )
    )
  )

const finiteNumber = Option.liftPredicate(Schema.is(Schema.JsonNumber))

const numericVectorFromValue = (value: ObjectiveValue): Option.Option<typeof ObjectiveVectorSchema.Type> =>
  Match.value(value).pipe(
    Match.when(Match.number, (numeric) => Option.some(Arr.of(numeric))),
    Match.when(Schema.is(ObjectiveVectorSchema), (candidate) => Option.all(Arr.map(candidate, finiteNumber))),
    Match.exhaustive
  )

const mean = (values: typeof ObjectiveVectorSchema.Type): number =>
  Num.unsafeDivide(Num.sumAll(values), Arr.length(values))

const populationVariance = (values: typeof ObjectiveVectorSchema.Type): number => {
  const avg = mean(values)
  return Num.unsafeDivide(
    Arr.reduce(values, 0, (sum, value) => {
      const centered = Num.subtract(value, avg)
      return Num.sum(sum, Num.multiply(centered, centered))
    }),
    Arr.length(values)
  )
}

const aggregateVectors = (
  vectors: typeof ObjectiveVectors.Type
): Option.Option<typeof ObjectiveAggregate.Type> =>
  Option.gen(function*() {
    const first = yield* Arr.head(vectors)
    const dimensionCount = yield* Option.liftPredicate(Arr.length(first), Num.greaterThan(0))
    yield* Option.liftPredicate(vectors, Arr.every((vector) => Num.Equivalence(Arr.length(vector), dimensionCount)))
    const dimensions = yield* Option.all(Arr.makeBy(
      dimensionCount,
      (dimension) => Option.all(Arr.map(vectors, (vector) => Arr.get(vector, dimension)))
    ))
    const means = Arr.map(dimensions, mean)
    const variance = mean(Arr.map(dimensions, populationVariance))
    const value = yield* Match.value(dimensionCount).pipe(
      Match.when(1, () => Arr.head(means)),
      Match.orElse(() => Option.some(means))
    )
    return ObjectiveAggregate.make({ value, variance })
  })

/**
 * Computes the mean value and population variance across multiple objective samples for multi-evaluation trials.
 *
 * @since 0.1.0
 * @category utils
 */
export const aggregateObjectiveSamples = (
  trialNumber: number,
  samples: typeof ObjectiveSamples.Type
): Effect.Effect<ObjectiveAttempt, TrialError> =>
  Effect.gen(function*() {
    yield* Effect.fail(
      objectiveFailure(
        trialNumber,
        invalidObjectiveResult(trialNumber, "objective evaluation set must contain at least one result")
      )
    ).pipe(Effect.when(() => Arr.isEmptyReadonlyArray(samples)))

    return yield* Option.all(Arr.map(samples, (sample) => numericVectorFromValue(sample.value))).pipe(
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
              evaluationCount: Arr.length(samples),
              variance,
              ...Bool.match(hasCost, {
                onTrue: () => ({
                  cost: Arr.reduce(
                    samples,
                    0,
                    (total, sample) => Num.sum(total, Option.fromNullable(sample.cost).pipe(Option.getOrElse(() => 0)))
                  )
                }),
                onFalse: () => ({})
              })
            })
          )
        }
      })
    )
  })
