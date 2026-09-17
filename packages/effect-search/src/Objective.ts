/**
 * Objective shape, values, and native tagged operations.
 *
 * @since 0.1.0
 * @module
 */
import { Array as Arr, Data, Match, Number as Num, Option, Schema } from "effect"

import { Direction, minimize, orDefault } from "./Direction.js"

/**
 * Scalar objective direction or ordered multi-objective directions.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Objective = Schema.Union(
  Schema.TaggedStruct("Single", { direction: Direction }),
  Schema.TaggedStruct("Multi", { directions: Schema.Array(Direction) })
)

/** Objective specification decoded by {@link Objective}. @since 0.1.0 @category models */
export type Objective = typeof Objective.Type

const objectives = Data.taggedEnum<Objective>()

/** Constructs a scalar objective specification. @since 0.1.0 @category constructors */
export const Single = objectives.Single

/** Constructs a vector objective specification. @since 0.1.0 @category constructors */
export const Multi = objectives.Multi

/** Narrows an objective specification by tag. @since 0.1.0 @category guards */
export const is = objectives.$is

/** Exhaustively dispatches a scalar or vector objective specification. @since 0.1.0 @category pattern matching */
export const match = objectives.$match

/**
 * Ordered multi-objective coordinates.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Vector = Schema.Array(Schema.Number)

/** Objective vector decoded by {@link Vector}. @since 0.1.0 @category models */
export type Vector = typeof Vector.Type

/**
 * Scalar or ordered-vector objective result.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Value = Schema.Union(Schema.Number, Vector)

/** Objective result decoded by {@link Value}. @since 0.1.0 @category models */
export type Value = typeof Value.Type

const isVector = Schema.is(Vector)
const finiteValue = Schema.is(Schema.Union(Schema.JsonNumber, Schema.Array(Schema.JsonNumber)))

/** Counts scalar or vector coordinates. @since 0.1.0 @category combinators */
export const dimensionCount = (value: Value): number =>
  Match.value(value).pipe(
    Match.when(Match.number, () => 1),
    Match.when(isVector, Arr.length),
    Match.exhaustive
  )

/** Tests whether a value contains at least one coordinate. @since 0.1.0 @category guards */
export const hasDimensions = (value: Value): boolean => Num.greaterThan(dimensionCount(value), 0)

/** Tests whether every objective coordinate is finite. @since 0.1.0 @category guards */
export const isFiniteValue = (value: Value): boolean => finiteValue(value)

/** Converts a scalar to a singleton vector and preserves vectors. @since 0.1.0 @category combinators */
export const toVector = (value: Value): Vector => Arr.ensure(value)

/** Counts the declared objective dimensions. @since 0.1.0 @category combinators */
export const dimensions = (objective: Objective): number =>
  match({
    Single: () => 1,
    Multi: ({ directions }) => Arr.length(directions)
  })(objective)

/** Finds the direction declared for a coordinate. @since 0.1.0 @category combinators */
export const directionAt = (objective: Objective, index: number): Option.Option<Direction> =>
  match({
    Single: ({ direction }) =>
      Match.value(index).pipe(
        Match.when(0, () => Option.some(direction)),
        Match.orElse(() => Option.none<Direction>())
      ),
    Multi: ({ directions }) => Arr.get(directions, index)
  })(objective)

/** Constructs a scalar objective, defaulting to minimization. @since 0.1.0 @category constructors */
export const single = (direction: Direction = minimize): Objective => Single({ direction })

/** Copies directions into a multi-objective specification. @since 0.1.0 @category constructors */
export const multi = (directions: Iterable<Direction>): Objective => Multi({ directions: Arr.fromIterable(directions) })

/**
 * Validated option shape consumed by {@link fromOptions}.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Options = Schema.Struct({
  direction: Schema.optional(Direction),
  directions: Schema.optional(Schema.Array(Direction))
})

/** Objective options decoded by {@link Options}. @since 0.1.0 @category models */
export type Options = typeof Options.Type

/**
 * Resolves options to scalar or vector semantics. A non-empty direction vector wins.
 *
 * @since 0.1.0
 * @category constructors
 */
export const fromOptions = (options: Options): Objective =>
  Option.fromNullable(options.directions).pipe(
    Option.filter(Arr.isNonEmptyReadonlyArray),
    Option.match({
      onNone: () => single(orDefault(Option.fromNullable(options.direction))),
      onSome: multi
    })
  )
