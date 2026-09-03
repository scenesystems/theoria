/**
 * Objective arity and per-coordinate comparison directions.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Match, Option, Schema } from "effect"

import { defaultDirection, type Direction, directionOrDefault, DirectionSchema } from "./Direction.js"

/**
 * Decodes scalar objective direction or an ordered direction vector.
 *
 * @remarks
 * The `Multi` branch accepts an empty vector. Constructors and study option
 * normalization normally avoid that state, but this schema does not reject it.
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
 * Establishes scalar comparison or positional directions for a vector objective.
 *
 * @since 0.1.0
 * @category models
 */
export type ObjectiveSpec = Schema.Schema.Type<typeof ObjectiveSpecSchema>

const ObjectiveSpecs = Data.taggedEnum<ObjectiveSpec>()

const { Single: _Single, Multi: _Multi, $is: _$is, $match: _$match } = ObjectiveSpecs

/**
 * Constructs the scalar branch with an explicit comparison direction.
 *
 * @since 0.1.0
 * @category constructors
 */
export const Single = _Single

/**
 * Constructs the vector branch whose positions define objective order and polarity.
 *
 * @since 0.1.0
 * @category constructors
 */
export const Multi = _Multi

/**
 * Builds a predicate that narrows an objective specification by `_tag`.
 *
 * @typeParam Tag - Objective discriminator selected for narrowing.
 *
 * @since 0.1.0
 * @category guards
 */
export const isObjectiveSpec = _$is

/**
 * Dispatches an objective specification to a handler for its scalar or vector branch.
 *
 * @typeParam Cases - Exhaustive handler record whose return values determine the result union.
 *
 * @since 0.1.0
 * @category pattern-matching
 */
export const matchObjectiveSpec = _$match

/**
 * Constructs a scalar objective specification, defaulting to `"minimize"`.
 *
 * @since 0.1.0
 * @category constructors
 */
export const singleObjectiveSpec = (direction: Direction = defaultDirection()): ObjectiveSpec => Single({ direction })

/**
 * Copies an ordered direction array into a vector objective specification.
 * The array length becomes the required objective arity; an empty array is retained.
 *
 * @since 0.1.0
 * @category constructors
 */
export const multiObjectiveSpec = (directions: ReadonlyArray<Direction>): ObjectiveSpec =>
  Multi({ directions: Arr.fromIterable(directions) })

/**
 * Counts one dimension for `Single` and the direction entries for `Multi`.
 *
 * @since 0.1.0
 * @category combinators
 */
export const objectiveSpecDimensions = (spec: ObjectiveSpec): number =>
  matchObjectiveSpec({
    Single: () => 1,
    Multi: ({ directions }) => directions.length
  })(spec)

/**
 * Looks up a coordinate's comparison direction.
 *
 * @remarks
 * `Single` defines only index zero. `Multi` accepts integer indices within its
 * direction array. All other indices return `Option.none()`.
 *
 * @since 0.1.0
 * @category combinators
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
 * Resolves study options to scalar or vector objective semantics.
 *
 * @remarks
 * A non-empty `directions` array takes precedence over `direction`. An absent or
 * empty array selects `direction`, which defaults to `"minimize"`.
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
