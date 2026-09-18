/**
 * Built-in metric constructors.
 *
 * @since 0.1.0
 */
import type { Schema } from "effect"
import { Array as Arr, Number, Option, String } from "effect"
import { Result } from "../../Metric.js"
import { make } from "./constructors.js"
import { binaryScore, fieldString, tokenizedField, tokenOverlap } from "./score.js"

const singleScoreResult = (score: number): Result => new Result({ score })

/**
 * Scores `1` when normalized scalar fields are equal and `0` otherwise.
 *
 * @remarks
 * Strings are trimmed and lowercased; numbers and booleans are converted to
 * strings. Missing or non-scalar fields score `0`.
 *
 * @param field - Property read from both prediction and expected payloads.
 * @returns A pure metric named `exactMatch(<field>)`.
 *
 * @since 0.1.0
 * @category metrics
 */
export const exactMatch = (field: string) =>
  make(String.concat(String.concat("exactMatch(", field), ")"), (prediction: typeof Schema.Object.Type, expected) => {
    const score = Option.match(
      fieldString(prediction, field),
      {
        onNone: () => 0,
        onSome: (left) =>
          Option.match(fieldString(expected, field), {
            onNone: () => 0,
            onSome: (right) => binaryScore(String.Equivalence(left, right))
          })
      }
    )

    return singleScoreResult(score)
  })

const safeDivision = (numerator: number, denominator: number): number =>
  Option.getOrElse(Number.divide(numerator, denominator), () => 0)

/**
 * Computes multiset token F1 after scalar normalization and whitespace
 * splitting. Missing fields and zero-overlap inputs score `0`.
 *
 * @remarks
 * Repeated tokens contribute at most their occurrence count in the other value.
 *
 * @param field - Property read from both prediction and expected payloads.
 * @returns A pure metric named `f1(<field>)` with scores between `0` and `1`.
 *
 * @since 0.1.0
 * @category metrics
 */
export const f1 = (field: string) =>
  make(String.concat(String.concat("f1(", field), ")"), (prediction: typeof Schema.Object.Type, expected) => {
    const score = Option.match(
      tokenizedField(prediction, field),
      {
        onNone: () => 0,
        onSome: (predictionTokens) =>
          Option.match(tokenizedField(expected, field), {
            onNone: () => 0,
            onSome: (expectedTokens) => {
              const overlap = tokenOverlap(predictionTokens, expectedTokens)
              const precision = safeDivision(overlap, Arr.length(predictionTokens))
              const recall = safeDivision(overlap, Arr.length(expectedTokens))

              return safeDivision(Number.multiply(Number.multiply(2, precision), recall), Number.sum(precision, recall))
            }
          })
      }
    )

    return singleScoreResult(score)
  })

/**
 * Scores `1` when the normalized prediction field contains the normalized
 * target, and `0` for absence, missing fields, or non-scalar values.
 *
 * @remarks
 * The expected payload is ignored. Target matching is case-insensitive and
 * trims both values. An empty target therefore matches every scalar field.
 *
 * @param field - Prediction property searched for the target.
 * @param target - Substring normalized once when the metric is constructed.
 * @returns A pure metric named with the field and normalized target.
 *
 * @since 0.1.0
 * @category metrics
 */
export const contains = (field: string, target: string) => {
  const normalizedTarget = String.toLowerCase(String.trim(target))

  return make(
    Arr.join(Arr.make("contains(", field, ",", normalizedTarget, ")"), ""),
    (prediction: typeof Schema.Object.Type) => {
      const score = Option.match(fieldString(prediction, field), {
        onNone: () => 0,
        onSome: (value) => binaryScore(String.includes(normalizedTarget)(value))
      })

      return singleScoreResult(score)
    }
  )
}
