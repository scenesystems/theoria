/**
 * Metric scoring helpers.
 *
 * @since 0.1.0
 */
import { Array as Arr, Match, Option, Predicate, Record } from "effect"
import type { MetricPayload } from "../contracts/MetricFn.js"

const normalize = (value: string): string => value.trim().toLowerCase()

const scalarString = (value: unknown): Option.Option<string> =>
  Match.value(value).pipe(
    Match.when(Predicate.isString, (text) => Option.some(text)),
    Match.when(Predicate.isNumber, (numberValue) => Option.some(String(numberValue))),
    Match.when(Predicate.isBoolean, (booleanValue) => Option.some(String(booleanValue))),
    Match.orElse(() => Option.none<string>())
  )

/**
 * Read a field from a metric payload as a normalized (trimmed, lowercased)
 * string. Returns `Option.none()` for missing or non-scalar fields.
 *
 * @since 0.1.0
 * @category helpers
 */
export const fieldString = (payload: MetricPayload, field: string): Option.Option<string> =>
  Option.map(
    Option.flatMap(
      Option.fromNullable(payload[field]),
      scalarString
    ),
    normalize
  )

const nonEmptyToken = (token: string): Option.Option<string> =>
  Option.fromNullable(token.trim()).pipe(
    Option.flatMap((value) =>
      value.length === 0
        ? Option.none<string>()
        : Option.some(value)
    )
  )

/**
 * Read a field as normalized whitespace-delimited tokens. Returns
 * `Option.none()` for missing fields.
 *
 * @since 0.1.0
 * @category helpers
 */
export const tokenizedField = (payload: MetricPayload, field: string): Option.Option<ReadonlyArray<string>> =>
  Option.map(fieldString(payload, field), (value) => Arr.filterMap(value.split(/\s+/), nonEmptyToken))

const tokenCounts = (tokens: ReadonlyArray<string>): Readonly<Record<string, number>> =>
  Arr.reduce(tokens, Record.empty<string, number>(), (counts, token) =>
    Record.set(
      counts,
      token,
      Option.getOrElse(
        Option.map(Record.get(counts, token), (count) => count + 1),
        () => 1
      )
    ))

type OverlapState = Readonly<{
  readonly overlap: number
  readonly rightCounts: Readonly<Record<string, number>>
}>

/**
 * Compute multiset token overlap between two token arrays — counts each token
 * at most as many times as it appears in the right array.
 *
 * @since 0.1.0
 * @category helpers
 */
export const tokenOverlap = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): number =>
  Arr.reduce(
    left,
    {
      overlap: 0,
      rightCounts: tokenCounts(right)
    },
    (state, token): OverlapState =>
      Option.match(Record.get(state.rightCounts, token), {
        onNone: () => state,
        onSome: (count) =>
          count <= 0
            ? state
            : {
              overlap: state.overlap + 1,
              rightCounts: Record.set(state.rightCounts, token, count - 1)
            }
      })
  ).overlap

/**
 * Arithmetic mean of a number array. Returns `0` for empty arrays rather than
 * `NaN`.
 *
 * @since 0.1.0
 * @category helpers
 */
export const averageNumbers = (scores: ReadonlyArray<number>): number =>
  scores.length === 0
    ? 0
    : Arr.reduce(scores, 0, (sum, score) => sum + score) / scores.length

/**
 * Convert a boolean condition to a `{0, 1}` score for deterministic binary
 * metrics.
 *
 * @since 0.1.0
 * @category helpers
 */
export const binaryScore = (condition: boolean): number => (condition ? 1 : 0)
