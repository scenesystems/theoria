/**
 * Built-in metric constructors.
 *
 * @since 0.1.0
 */
import { Option } from "effect"
import type { MetricResult } from "../contracts/MetricResult.js"
import { make } from "./constructors.js"
import { Result } from "./model.js"
import { averageNumbers, binaryScore, fieldString, tokenizedField, tokenOverlap } from "./score.js"

const singleScoreResult = (score: number): MetricResult => new Result({ score })

/**
 * Scores `1` when normalized scalar fields are equal and `0` otherwise.
 *
 * @remarks
 * Strings are trimmed and lowercased; numbers and booleans are converted to
 * strings. Missing or non-scalar fields score `0`.
 *
 * @since 0.1.0
 * @category metrics
 */
export const exactMatch = (field: string) =>
  make(`exactMatch(${field})`, (prediction, expected) => {
    const score = Option.match(
      fieldString(prediction, field),
      {
        onNone: () => 0,
        onSome: (left) =>
          Option.match(fieldString(expected, field), {
            onNone: () => 0,
            onSome: (right) => binaryScore(left === right)
          })
      }
    )

    return singleScoreResult(score)
  })

const safeDivision = (numerator: number, denominator: number): number => denominator === 0 ? 0 : numerator / denominator

/**
 * Computes multiset token F1 after scalar normalization and whitespace
 * splitting. Missing fields and zero-overlap inputs score `0`.
 *
 * @since 0.1.0
 * @category metrics
 */
export const f1 = (field: string) =>
  make(`f1(${field})`, (prediction, expected) => {
    const score = Option.match(
      tokenizedField(prediction, field),
      {
        onNone: () => 0,
        onSome: (predictionTokens) =>
          Option.match(tokenizedField(expected, field), {
            onNone: () => 0,
            onSome: (expectedTokens) => {
              const overlap = tokenOverlap(predictionTokens, expectedTokens)
              const precision = safeDivision(overlap, predictionTokens.length)
              const recall = safeDivision(overlap, expectedTokens.length)

              return averageNumbers([safeDivision(2 * precision * recall, precision + recall)])
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
 * The expected payload is ignored.
 *
 * @since 0.1.0
 * @category metrics
 */
export const contains = (field: string, target: string) => {
  const normalizedTarget = target.trim().toLowerCase()

  return make(`contains(${field},${normalizedTarget})`, (prediction) => {
    const score = Option.match(fieldString(prediction, field), {
      onNone: () => 0,
      onSome: (value) => binaryScore(value.includes(normalizedTarget))
    })

    return singleScoreResult(score)
  })
}
