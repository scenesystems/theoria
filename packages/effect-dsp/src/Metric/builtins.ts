/**
 * Built-in metric constructors.
 *
 * @since 0.0.0
 */
import { Option } from "effect"
import type { MetricResult } from "../contracts/MetricResult.js"
import { make } from "./constructors.js"
import { Result } from "./model.js"
import { averageNumbers, binaryScore, fieldString, tokenizedField, tokenOverlap } from "./score.js"

const singleScoreResult = (score: number): MetricResult => new Result({ score })

/**
 * Exact-match metric — scores 1 when the specified field matches exactly
 * (case-insensitive, trimmed), 0 otherwise.
 *
 * @since 0.0.0
 * @category built-ins
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
 * Token-level F1 metric — computes precision, recall, and their harmonic mean
 * over whitespace-delimited tokens in the specified field.
 *
 * @since 0.0.0
 * @category built-ins
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
 * Substring-membership metric — scores 1 when the specified field contains the
 * target string (case-insensitive, trimmed), 0 otherwise.
 *
 * @since 0.0.0
 * @category built-ins
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
