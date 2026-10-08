/**
 * Built-in metric constructors.
 *
 * @since 0.1.0
 */
import { Array as Arr, Boolean, Effect, Match, Number, Option, pipe, Predicate, Record, Schema, String } from "effect"
import { Score } from "../../Metric.js"
import { fromSync, withFeedback } from "./constructors.js"
import { binaryScore, fieldString, tokenizedField, tokenOverlap } from "./score.js"

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
  fromSync((expected, prediction) => {
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

    return score
  }, `exactMatch(${field})`)

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
  fromSync((expected, prediction) => {
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

    return score
  }, `f1(${field})`)

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

  return fromSync(
    (_labels, prediction) => {
      const score = Option.match(fieldString(prediction, field), {
        onNone: () => 0,
        onSome: (value) => binaryScore(String.includes(normalizedTarget)(value))
      })

      return score
    },
    Arr.join(Arr.make("contains(", field, ",", normalizedTarget, ")"), "")
  )
}

const normalizeAnswer = (text: string) =>
  pipe(
    text,
    String.normalize("NFD"),
    String.toLowerCase,
    String.replace(/[!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~]/g, ""),
    String.replace(/(?<![\p{L}\p{N}_])(a|an|the)(?![\p{L}\p{N}_])/gu, " "),
    String.replaceAll("\u001c", " "),
    String.replaceAll("\u001d", " "),
    String.replaceAll("\u001e", " "),
    String.replaceAll("\u001f", " "),
    String.replace(/\p{White_Space}+/gu, " "),
    String.trim
  )

const Answers = Schema.Struct({ answer: Schema.Union([Schema.String, Schema.Array(Schema.String)]) })
const answers = (labels: Record.ReadonlyRecord<string, unknown>) =>
  Schema.decodeUnknownEffect(Answers)(labels).pipe(
    Effect.map(({ answer }) =>
      Arr.map(
        Match.value(answer).pipe(
          Match.when(Predicate.isString, (single) => Arr.of(single)),
          Match.orElse((many) => many)
        ),
        normalizeAnswer
      )
    )
  )

const whitespaceTokens = (text: string) => Arr.filter(String.split(text, " "), String.isNonEmpty)
const dprTokens = (text: string) =>
  Option.getOrElse(String.match(/[\p{L}\p{N}\p{M}]+|[^\p{Z}\p{C}]/gu)(text), Arr.empty)

/** DSPy answer equality after NFD, lowercase, ASCII punctuation/article removal
 * and whitespace normalization. A fraction below one selects multiset-token F1.
 * Invalid answer fields fail schema validation.
 * @since 0.7.0
 * @category metrics
 */
export const answerExactMatch = (fraction = 1) =>
  withFeedback((example, prediction) =>
    Effect.gen(function*() {
      const references = yield* answers(Option.getOrElse(example.labels, Record.empty))
      yield* Schema.decodeUnknownEffect(Schema.NonEmptyArray(Schema.String))(references)
      const { answer } = yield* Schema.decodeUnknownEffect(Schema.Struct({ answer: Schema.String }))(prediction.output)
      const normalized = normalizeAnswer(answer)
      const matched = Arr.some(references, (reference) =>
        Boolean.match(fraction >= 1, {
          onFalse: () => {
            const left = whitespaceTokens(normalized)
            const right = whitespaceTokens(reference)
            return safeDivision(2 * tokenOverlap(left, right), Arr.length(left) + Arr.length(right)) >= fraction
          },
          onTrue: () => String.Equivalence(normalized, reference)
        }))
      return new Score({ value: binaryScore(matched), feedback: Option.none() })
    }), "answerExactMatch")

/** DSPy passage matching: a normalized answer must be a contiguous DPR token
 * sequence in one context passage, not a character substring.
 * @since 0.7.0
 * @category metrics
 */
export const answerPassageMatch = () =>
  withFeedback((example, prediction) =>
    Effect.gen(function*() {
      const references = yield* answers(Option.getOrElse(example.labels, Record.empty))
      const { context } = yield* Schema.decodeUnknownEffect(Schema.Struct({ context: Schema.Array(Schema.String) }))(
        prediction.output
      )
      const matched = Arr.some(context, (passage) => {
        const tokens = dprTokens(normalizeAnswer(passage))
        return Arr.some(references, (reference) => {
          const target = dprTokens(reference)
          return Arr.some(
            Arr.range(0, Arr.length(tokens)),
            (start) =>
              Arr.makeEquivalence(String.Equivalence)(Arr.take(Arr.drop(tokens, start), Arr.length(target)), target)
          )
        })
      })
      return new Score({ value: binaryScore(matched), feedback: Option.none() })
    }), "answerPassageMatch")
