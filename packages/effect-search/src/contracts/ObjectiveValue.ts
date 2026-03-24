/**
 * Objective values — scalar or vector representations of optimization results.
 *
 * @since 0.1.0
 */
import { Array as Arr, Match, Number as Num, Schema } from "effect"

/**
 * Ordered array of numeric objective values for multi-objective optimization.
 * Each element corresponds to one objective dimension, and the element order
 * must match the direction order in the study's objective spec.
 *
 * @see {@link ObjectiveVector} extracted type
 * @see {@link ObjectiveValueSchema} union that accepts both scalar and vector forms
 *
 * @since 0.1.0
 * @category schemas
 */
export const ObjectiveVectorSchema = Schema.Array(Schema.Number)

/**
 * Extracted type of {@link ObjectiveVectorSchema} — a `ReadonlyArray<number>`
 * where each element is one objective dimension's value.
 *
 * @see {@link ObjectiveVectorSchema} source schema
 * @see {@link isObjectiveVector} type guard to narrow from `ObjectiveValue`
 *
 * @since 0.1.0
 * @category type-level
 */
export type ObjectiveVector = Schema.Schema.Type<typeof ObjectiveVectorSchema>

/**
 * Union of scalar `number` (single-objective) and {@link ObjectiveVectorSchema}
 * (multi-objective). Single-objective studies produce a plain number;
 * multi-objective studies produce an ordered vector. Most pipeline functions
 * accept this union and branch internally via {@link isObjectiveVector}.
 *
 * @see {@link ObjectiveValue} extracted type
 * @see {@link normalizeObjectiveVector} promotes scalars to singleton vectors
 *
 * @since 0.1.0
 * @category schemas
 */
export const ObjectiveValueSchema = Schema.Union(Schema.Number, ObjectiveVectorSchema)

/**
 * Extracted type of {@link ObjectiveValueSchema} — either a scalar `number`
 * or an {@link ObjectiveVector}. This is the primary value type flowing
 * through trial results, comparators, and ranking logic.
 *
 * @see {@link ObjectiveValueSchema} source schema
 * @see {@link isObjectiveVector} narrow to the vector branch
 *
 * @since 0.1.0
 * @category type-level
 */
export type ObjectiveValue = Schema.Schema.Type<typeof ObjectiveValueSchema>

/**
 * Reports whether the given objective value is a multi-dimensional vector
 * rather than a scalar. Use this to branch logic that must handle
 * single-objective and multi-objective paths differently (e.g., comparators,
 * Pareto-front construction).
 *
 * @see {@link ObjectiveVector} the narrowed type
 * @see {@link objectiveDimensionCount} get the exact dimension count
 *
 * @since 0.1.0
 * @category guards
 */
export const isObjectiveVector = (value: ObjectiveValue): value is ObjectiveVector => Arr.isArray(value)

/**
 * Returns the number of objective dimensions in a value — `1` for a scalar
 * (single-objective optimization) or `N` for a vector with `N` elements
 * (multi-objective optimization). An empty vector returns `0`, which
 * indicates a degenerate configuration caught by {@link hasObjectiveDimensions}.
 *
 * @see {@link hasObjectiveDimensions} boolean check for non-zero dimensions
 * @see {@link isObjectiveVector} type-narrowing guard
 *
 * @since 0.1.0
 * @category utils
 */
export const objectiveDimensionCount = (value: ObjectiveValue): number =>
  Match.value(value).pipe(
    Match.when(Match.number, () => 1),
    Match.orElse((vector) => vector.length)
  )

/**
 * Reports whether the objective value has at least one dimension. Scalars
 * always return `true`; vectors return `false` only when empty, which
 * signals a misconfigured objective spec.
 *
 * @see {@link objectiveDimensionCount} the underlying count
 *
 * @since 0.1.0
 * @category guards
 */
export const hasObjectiveDimensions = (value: ObjectiveValue): boolean =>
  Num.greaterThan(objectiveDimensionCount(value), 0)

const finiteObjectiveVector = (value: ObjectiveVector): boolean => value.every((entry) => Number.isFinite(entry))

/**
 * Reports whether every component of the objective value is finite (not
 * `NaN`, `Infinity`, or `-Infinity`). Non-finite values typically appear
 * when a trial fails, is pruned early, or produces degenerate results.
 * Comparators and ranking logic should filter these out before ordering.
 *
 * @see {@link objectiveDimensionCount} check dimensionality before comparing
 * @see {@link normalizeObjectiveVector} convert to vector form for uniform processing
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
 * Promotes a scalar objective value to a singleton vector, leaving vectors
 * unchanged. This lets downstream code (e.g., element-wise comparison,
 * Pareto dominance checks) operate uniformly on arrays without branching
 * on the scalar-vs-vector union.
 *
 * @see {@link isObjectiveVector} check before calling if you need to distinguish
 * @see {@link ObjectiveValueSchema} the union this normalizes
 *
 * @since 0.1.0
 * @category utils
 */
export const normalizeObjectiveVector = (value: ObjectiveValue): ReadonlyArray<number> =>
  Match.value(value).pipe(
    Match.when(Match.number, (entry) => [entry]),
    Match.orElse((entries) => entries)
  )
