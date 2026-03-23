/**
 * Objective specification — single or multi-objective optimization targets.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Match, Option, Schema } from "effect"

import { defaultDirection, type Direction, directionOrDefault, DirectionSchema } from "./Direction.js"

/**
 * Discriminated union schema for optimization objectives. The `_tag` field
 * distinguishes `Single` (one direction) from `Multi` (a per-objective
 * directions array), letting decoders choose the right variant automatically.
 *
 * @see {@link Direction} — the `"minimize" | "maximize"` literal each variant wraps
 * @see {@link ObjectiveSpec} — the inferred TypeScript type
 *
 * @since 0.1.0
 * @category schemas
 */
export const ObjectiveSpecSchema = Schema.Union(
  Schema.TaggedStruct("Single", {
    direction: DirectionSchema
  }),
  Schema.TaggedStruct("Multi", {
    directions: Schema.Array(DirectionSchema)
  })
)

/**
 * The optimization target that drives how the optimizer evaluates trial
 * results — either a single direction (`Single`) or independent directions
 * per objective dimension (`Multi`).
 *
 * @see {@link ObjectiveSpecSchema} — the schema this type is derived from
 * @see {@link ObjectiveValue} — the value the optimizer scores against this spec
 *
 * @since 0.1.0
 * @category models
 */
export type ObjectiveSpec = Schema.Schema.Type<typeof ObjectiveSpecSchema>

const ObjectiveSpecs = Data.taggedEnum<ObjectiveSpec>()

const { Single: _Single, Multi: _Multi, $is: _$is, $match: _$match } = ObjectiveSpecs

/**
 * Construct a single-objective spec with one optimization direction.
 * Use when the search has exactly one scalar objective to optimize.
 *
 * @see {@link Multi} — use instead when optimizing multiple objectives independently
 * @see {@link singleObjectiveSpec} — convenience wrapper that defaults to `"minimize"`
 *
 * @since 0.1.0
 * @category constructors
 */
export const Single = _Single

/**
 * Construct a multi-objective spec with independent directions per dimension.
 * Use when the search optimizes several objectives that may have different
 * directions (e.g. minimize latency while maximizing throughput).
 *
 * @see {@link Single} — use instead for a single scalar objective
 * @see {@link multiObjectiveSpec} — convenience wrapper
 *
 * @since 0.1.0
 * @category constructors
 */
export const Multi = _Multi

/**
 * Type guard that narrows an unknown value to a specific `ObjectiveSpec`
 * variant by its `_tag`. Returns a refinement predicate.
 *
 * @see {@link matchObjectiveSpec} — exhaustive pattern matching over both variants
 *
 * @since 0.1.0
 * @category guards
 */
export const isObjectiveSpec = _$is

/**
 * Exhaustive pattern matcher over `Single` and `Multi` variants. The
 * compiler enforces that both branches are handled — adding a new variant
 * to the union produces a type error at every call site.
 *
 * @see {@link isObjectiveSpec} — use for narrowing instead of exhaustive matching
 *
 * @since 0.1.0
 * @category pattern-matching
 */
export const matchObjectiveSpec = _$match

/**
 * Convenience constructor for a single-objective spec. When called without
 * arguments, defaults to `"minimize"` — the most common optimization direction.
 *
 * @see {@link Single} — the underlying tagged constructor
 * @see {@link defaultDirection} — the fallback direction used when none is provided
 *
 * @since 0.1.0
 * @category constructors
 */
export const singleObjectiveSpec = (direction: Direction = defaultDirection()): ObjectiveSpec => Single({ direction })

/**
 * Convenience constructor for a multi-objective spec. Takes an array of
 * per-objective directions — the array length defines the number of
 * objective dimensions the optimizer expects.
 *
 * @see {@link Multi} — the underlying tagged constructor
 * @see {@link objectiveSpecDimensions} — derives the dimension count from this spec
 *
 * @since 0.1.0
 * @category constructors
 */
export const multiObjectiveSpec = (directions: ReadonlyArray<Direction>): ObjectiveSpec =>
  Multi({ directions: Arr.fromIterable(directions) })

/**
 * Returns the number of objective dimensions — always `1` for `Single`,
 * `directions.length` for `Multi`. Use to validate that an
 * {@link ObjectiveValue} has the correct dimensionality for a given spec.
 *
 * @see {@link objectiveDirectionAt} — retrieve the direction for a specific dimension
 * @see {@link ObjectiveValue} — the value whose dimensionality this validates
 *
 * @since 0.1.0
 * @category utils
 */
export const objectiveSpecDimensions = (spec: ObjectiveSpec): number =>
  matchObjectiveSpec({
    Single: () => 1,
    Multi: ({ directions }) => directions.length
  })(spec)

/**
 * Retrieve the optimization direction for a specific objective dimension.
 * Returns `Option.none()` when the index is out of bounds — for `Single`
 * only index `0` is valid, for `Multi` the index must be within the
 * directions array.
 *
 * @see {@link objectiveSpecDimensions} — check how many dimensions are valid
 * @see {@link Direction} — the `"minimize" | "maximize"` value returned
 *
 * @since 0.1.0
 * @category utils
 */
export const objectiveDirectionAt = (spec: ObjectiveSpec, index: number): Option.Option<Direction> =>
  matchObjectiveSpec({
    Single: ({ direction }) =>
      Match.value(index).pipe(
        Match.when(0, () => Option.some(direction)),
        Match.orElse(() => Option.none())
      ),
    Multi: ({ directions }) => Arr.get(directions, index)
  })(spec)

/**
 * Resolve an `ObjectiveSpec` from user-provided options. A non-empty
 * `directions` array always wins and produces a `Multi` spec. When
 * `directions` is absent or empty, falls back to `direction` (or the
 * default `"minimize"`) to produce a `Single` spec.
 *
 * @see {@link singleObjectiveSpec} — used when the single-direction path is taken
 * @see {@link multiObjectiveSpec} — used when a directions array is provided
 *
 * @since 0.1.0
 * @category constructors
 */
export const objectiveSpecFromOptions = (options: {
  readonly direction?: Direction
  readonly directions?: ReadonlyArray<Direction>
}): ObjectiveSpec =>
  Option.fromNullable(options.directions).pipe(
    Option.filter((directions) => directions.length > 0),
    Option.match({
      onNone: () => singleObjectiveSpec(directionOrDefault(Option.fromNullable(options.direction))),
      onSome: (directions) => multiObjectiveSpec(directions)
    })
  )
