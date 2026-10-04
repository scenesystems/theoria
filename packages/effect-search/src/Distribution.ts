/**
 * Sampling metadata attached to search-space schemas.
 *
 * @since 0.1.0
 * @module
 */
import { Option, Schema, SchemaAST } from "effect"

/**
 * Primitive categorical choice.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Choice = Schema.Union([Schema.String, Schema.Finite, Schema.Boolean, Schema.Null])

/** A categorical choice decoded by {@link Choice}. @since 0.1.0 @category models */
export type Choice = typeof Choice.Type

/**
 * Continuous or stepped numeric distribution.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Float = Schema.Struct({
  type: Schema.Literal("float"),
  low: Schema.Finite,
  high: Schema.Finite,
  scale: Schema.optional(Schema.Literals(["linear", "log"])),
  step: Schema.optional(Schema.Finite)
})

/** A floating-point distribution decoded by {@link Float}. @since 0.1.0 @category models */
export type Float = typeof Float.Type

/**
 * Inclusive integer distribution.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Int = Schema.Struct({
  type: Schema.Literal("int"),
  low: Schema.Finite,
  high: Schema.Finite,
  step: Schema.optional(Schema.Finite)
})

/** An integer distribution decoded by {@link Int}. @since 0.1.0 @category models */
export type Int = typeof Int.Type

/**
 * Inclusive multi-fidelity resource distribution.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Fidelity = Schema.Struct({
  type: Schema.Literal("fidelity"),
  low: Schema.Finite,
  high: Schema.Finite
})

/** A fidelity distribution decoded by {@link Fidelity}. @since 0.1.0 @category models */
export type Fidelity = typeof Fidelity.Type

/**
 * Unordered categorical distribution.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Categorical = Schema.Struct({
  type: Schema.Literal("categorical"),
  choices: Schema.Array(Choice)
})

/** A categorical distribution decoded by {@link Categorical}. @since 0.1.0 @category models */
export type Categorical = typeof Categorical.Type

/**
 * Search-space distribution metadata.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Distribution = Schema.Union([Float, Int, Fidelity, Categorical])

/** Distribution metadata decoded by {@link Distribution}. @since 0.1.0 @category models */
export type Distribution = typeof Distribution.Type

const annotationKey = "@scenesystems/effect-search/Distribution"

/**
 * Annotates a schema with validated distribution metadata.
 *
 * @since 0.1.0
 * @category annotations
 */
export const annotate = <A, I, RD, RE>(
  schema: Schema.Codec<A, I, RD, RE>,
  distribution: Distribution
): Schema.Codec<A, I, RD, RE> => schema.annotate({ [annotationKey]: distribution })

/**
 * Decodes distribution metadata from a schema AST annotation.
 * Invalid annotations are treated as absent.
 *
 * @since 0.1.0
 * @category annotations
 */
export const fromAST = (ast: SchemaAST.AST): Option.Option<Distribution> =>
  Option.fromNullishOr(SchemaAST.resolveAt<unknown>(annotationKey)(ast)).pipe(
    Option.flatMap(Schema.decodeUnknownOption(Distribution))
  )
