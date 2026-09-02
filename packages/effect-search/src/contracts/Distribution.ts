/**
 * Sampling metadata attached to tunable configuration fields.
 *
 * @since 0.1.0
 */
import type { Option } from "effect"
import { Schema, SchemaAST } from "effect"

/**
 * Decodes string, number, boolean, or null categorical choices.
 * Objects and arrays are rejected. Numeric choices may be non-finite.
 *
 * @since 0.1.0
 * @category schemas
 */
export const PrimitiveChoiceSchema = Schema.Union(
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.Null
)

/**
 * Primitive categorical value compared by the sampler without structural identity.
 *
 * @since 0.1.0
 * @category type-level
 */
export type PrimitiveChoice = Schema.Schema.Type<typeof PrimitiveChoiceSchema>

/**
 * Describes a continuous or stepped numeric dimension with linear or logarithmic scale.
 *
 * @remarks
 * This schema checks field types only. {@link SearchSpace.make} rejects non-finite
 * or reversed bounds, non-positive steps, and logarithmic ranges with a non-positive
 * lower bound.
 *
 * @since 0.1.0
 * @category schemas
 */
export const FloatDistributionSchema = Schema.Struct({
  type: Schema.Literal("float"),
  low: Schema.Number,
  high: Schema.Number,
  scale: Schema.optional(Schema.Literal("linear", "log")),
  step: Schema.optional(Schema.Number)
})

/**
 * Describes an integer dimension with inclusive bounds and an optional stride.
 *
 * @remarks
 * The schema itself accepts any numbers. {@link SearchSpace.make} requires finite
 * integer bounds with `low <= high` and a positive step when one is present.
 *
 * @since 0.1.0
 * @category schemas
 */
export const IntDistributionSchema = Schema.Struct({
  type: Schema.Literal("int"),
  low: Schema.Number,
  high: Schema.Number,
  step: Schema.optional(Schema.Number)
})

/**
 * Describes the inclusive integer resource range advanced by multi-fidelity schedulers.
 *
 * @remarks
 * The schema checks field types only. {@link SearchSpace.make} requires finite
 * integer bounds with `low <= high`; the scheduler determines intermediate resources.
 *
 * @since 0.1.0
 * @category schemas
 */
export const FidelityDistributionSchema = Schema.Struct({
  type: Schema.Literal("fidelity"),
  low: Schema.Number,
  high: Schema.Number
})

/**
 * Describes an unordered set of primitive choices.
 *
 * @remarks
 * Empty and duplicate arrays pass this schema. {@link SearchSpace.make} rejects an
 * empty choice set but retains duplicates.
 *
 * @since 0.1.0
 * @category schemas
 */
export const CategoricalDistributionSchema = Schema.Struct({
  type: Schema.Literal("categorical"),
  choices: Schema.Array(PrimitiveChoiceSchema)
})

/**
 * Decodes the structural metadata for float, integer, fidelity, and categorical dimensions.
 * Distribution-specific range validation occurs when {@link SearchSpace.make} compiles
 * an annotated configuration schema.
 *
 * @since 0.1.0
 * @category schemas
 */
export const DistributionSchema = Schema.Union(
  FloatDistributionSchema,
  IntDistributionSchema,
  FidelityDistributionSchema,
  CategoricalDistributionSchema
)

/**
 * Sampling metadata consumed by search-space compilation and sampler compatibility checks.
 *
 * @since 0.1.0
 * @category type-level
 */
export type Distribution = Schema.Schema.Type<typeof DistributionSchema>

/**
 * Global schema-annotation key read by search-space compilation.
 * Use {@link annotateDistribution} and {@link readDistribution} unless constructing
 * schema AST annotations directly.
 *
 * @since 0.1.0
 * @category annotations
 */
export const DistributionKey: unique symbol = Symbol.for("effect-search/Distribution")

/**
 * Returns a schema carrying the sampling metadata discovered by {@link SearchSpace.make}.
 * The decoded and encoded schema types, requirements, and validation behavior are unchanged.
 *
 * @typeParam A - Decoded value produced by the annotated schema.
 * @typeParam I - Encoded representation accepted by the annotated schema.
 * @typeParam R - Services required by schema decoding or encoding.
 *
 * @since 0.1.0
 * @category annotations
 */
export const annotateDistribution = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  distribution: Distribution
): Schema.Schema<A, I, R> => schema.annotations({ [DistributionKey]: distribution })

/**
 * Reads sampling metadata from a schema AST node.
 * Returns `Option.none()` when the node has no {@link DistributionKey} annotation.
 *
 * @since 0.1.0
 * @category annotations
 */
export const readDistribution = (ast: SchemaAST.AST): Option.Option<Distribution> =>
  SchemaAST.getAnnotation<Distribution>(DistributionKey)(ast)
