/**
 * Scalar and ordered-vector results accepted from objective functions.
 *
 * @since 0.1.0
 */
import { Array as Arr, Match, Number as Num, Schema } from "effect"

/**
 * Decodes ordered objective coordinates without enforcing non-empty or finite values.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ObjectiveVectorSchema = Schema.Array(Schema.Number)

/**
 * Ordered multi-objective result whose positions align with the study's directions.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ObjectiveVector = Schema.Schema.Type<typeof ObjectiveVectorSchema>

/**
 * Decodes either a scalar objective or an ordered objective vector.
 *
 * @remarks
 * The schema accepts non-finite numbers and empty vectors. Study execution applies
 * its objective arity and finiteness checks after an objective returns.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ObjectiveValueSchema = Schema.Union(Schema.Number, ObjectiveVectorSchema)

/**
 * Trial result that preserves the distinction between one scalar objective and
 * several ordered objectives.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ObjectiveValue = Schema.Schema.Type<typeof ObjectiveValueSchema>

/**
 * Narrows an objective value to its ordered-vector form.
 *
 * @since 0.1.0
 * @category guards
 */
export const isObjectiveVector = (value: ObjectiveValue): value is ObjectiveVector => Arr.isArray(value)

/**
 * Counts one dimension for a scalar and the number of entries for a vector.
 * An empty vector has zero dimensions.
 *
 * @since 0.1.0
 * @category combinators
 */
export const objectiveDimensionCount = (value: ObjectiveValue): number =>
  Match.value(value).pipe(
    Match.when(Match.number, () => 1),
    Match.orElse((vector) => vector.length)
  )

/**
 * Reports whether an objective value is a scalar or a non-empty vector.
 *
 * @since 0.1.0
 * @category guards
 */
export const hasObjectiveDimensions = (value: ObjectiveValue): boolean =>
  Num.greaterThan(objectiveDimensionCount(value), 0)

const finiteObjectiveVector = (value: ObjectiveVector): boolean => value.every((entry) => Number.isFinite(entry))

/**
 * Reports whether a scalar or every vector coordinate excludes `NaN` and infinities.
 * An empty vector satisfies this predicate; use {@link hasObjectiveDimensions} when
 * a value must also contain an objective.
 *
 * @since 0.1.0
 * @category guards
 */
export const isFiniteObjectiveValue = (value: ObjectiveValue): boolean =>
  Match.value(value).pipe(
    Match.when(Match.number, (entry) => Number.isFinite(entry)),
    Match.orElse(finiteObjectiveVector)
  )

/**
 * Wraps a scalar in a singleton array and preserves an existing vector's identity.
 *
 * @since 0.1.0
 * @category combinators
 */
export const normalizeObjectiveVector = (value: ObjectiveValue): ReadonlyArray<number> =>
  Match.value(value).pipe(
    Match.when(Match.number, (entry) => [entry]),
    Match.orElse((entries) => entries)
  )
