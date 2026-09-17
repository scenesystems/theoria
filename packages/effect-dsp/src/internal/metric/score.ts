/**
 * Metric scoring helpers.
 *
 * @since 0.1.0
 */
import { Array as Arr, Boolean, Match, Number, Option, Predicate, Record, Schema, String } from "effect"

const normalize = (value: string): string => String.toLowerCase(String.trim(value))

const Scalar = Schema.Union(Schema.String, Schema.Number, Schema.Boolean)

const scalarString = (value: typeof Scalar.Type): Option.Option<string> =>
  Match.value(value).pipe(
    Match.when(Predicate.isString, (text) => Option.some(text)),
    Match.when(Predicate.isNumber, Schema.encodeOption(Schema.NumberFromString)),
    Match.when(Predicate.isBoolean, (value) =>
      Option.some(Boolean.match(value, { onTrue: () => "true", onFalse: () => "false" }))),
    Match.exhaustive
  )

/**
 * Read a field from a metric payload as a normalized (trimmed, lowercased)
 * string. Returns `Option.none()` for missing or non-scalar fields.
 *
 * @since 0.1.0
 * @category helpers
 */
export const fieldString = (payload: typeof Schema.Object.Type, field: string): Option.Option<string> =>
  Schema.decodeUnknownOption(
    Schema.Struct(Record.singleton(field, Schema.optional(Scalar)))
  )(payload).pipe(
    Option.flatMap(Record.get(field)),
    Option.flatMap(Option.fromNullable),
    Option.flatMap(scalarString),
    Option.map(normalize)
  )

const nonEmptyToken = (token: string): Option.Option<string> =>
  Option.some(String.trim(token)).pipe(Option.filter(String.isNonEmpty))

/**
 * Read a field as normalized whitespace-delimited tokens. Returns
 * `Option.none()` for missing fields.
 *
 * @since 0.1.0
 * @category helpers
 */
export const tokenizedField = (
  payload: typeof Schema.Object.Type,
  field: string
) => Option.map(fieldString(payload, field), (value) => Arr.filterMap(String.split(value, /\s+/), nonEmptyToken))

const tokenCounts = (tokens: Iterable<string>) =>
  Arr.reduce(tokens, Record.empty<string, number>(), (counts, token) =>
    Record.set(
      counts,
      token,
      Option.getOrElse(
        Option.map(Record.get(counts, token), Number.increment),
        () => 1
      )
    ))

class OverlapState extends Schema.Class<OverlapState>("MetricOverlapState")({
  overlap: Schema.Number,
  rightCounts: Schema.Record({ key: Schema.String, value: Schema.Number })
}) {}

/**
 * Compute multiset token overlap between two token arrays — counts each token
 * at most as many times as it appears in the right array.
 *
 * @since 0.1.0
 * @category helpers
 */
export const tokenOverlap = (left: Iterable<string>, right: Iterable<string>): number =>
  Arr.reduce(
    left,
    new OverlapState({
      overlap: 0,
      rightCounts: tokenCounts(right)
    }),
    (state, token): OverlapState =>
      Option.match(Record.get(state.rightCounts, token), {
        onNone: () => state,
        onSome: (count) =>
          Boolean.match(Number.lessThanOrEqualTo(count, 0), {
            onTrue: () => state,
            onFalse: () =>
              new OverlapState({
                overlap: Number.increment(state.overlap),
                rightCounts: Record.set(state.rightCounts, token, Number.decrement(count))
              })
          })
      })
  ).overlap

/**
 * Arithmetic mean of a number array. Returns `0` for empty arrays rather than
 * `NaN`.
 *
 * @since 0.1.0
 * @category helpers
 */
export const averageNumbers = (scores: Iterable<number>): number => {
  const values = Arr.fromIterable(scores)
  return Option.getOrElse(Number.divide(Number.sumAll(values), Arr.length(values)), () => 0)
}

/**
 * Convert a boolean condition to a `{0, 1}` score for deterministic binary
 * metrics.
 *
 * @since 0.1.0
 * @category helpers
 */
export const binaryScore = (condition: boolean): number =>
  Boolean.match(condition, { onTrue: () => 1, onFalse: () => 0 })
