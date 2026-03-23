/**
 * Search-space distribution schemas — float, int, and categorical parameter distributions.
 *
 * @since 0.1.0
 */
import type { Option } from "effect"
import { Schema, SchemaAST } from "effect"

/**
 * Allowed value types for categorical dimension choices. Samplers and
 * search-space compilation use this to validate that every choice in a
 * `CategoricalDistributionSchema` is a JSON-safe primitive — objects and
 * arrays are intentionally excluded.
 *
 * @see {@link CategoricalDistributionSchema} — the distribution that carries an array of these
 * @see {@link PrimitiveChoice} — the extracted type alias
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
 * Extracted type of {@link PrimitiveChoiceSchema} — `string | number | boolean | null`.
 *
 * @see {@link PrimitiveChoiceSchema} — the runtime schema
 * @see {@link CategoricalDistributionSchema} — uses arrays of this type
 *
 * @since 0.1.0
 * @category type-level
 */
export type PrimitiveChoice = Schema.Schema.Type<typeof PrimitiveChoiceSchema>

/**
 * Continuous real-valued parameter range. Use for hyperparameters like
 * learning rate, dropout, or temperature where any float in `[low, high]`
 * is valid.
 *
 * Set `scale: "log"` when the parameter spans multiple orders of magnitude
 * (e.g. learning rate 1e-5 to 1e-1). Set `step` to discretize the range
 * into evenly spaced grid points — the sampler snaps suggestions to the
 * nearest step boundary.
 *
 * @see {@link IntDistributionSchema} — integer-valued alternative
 * @see {@link DistributionSchema} — the discriminated union containing this variant
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
 * Discrete integer parameter range over `[low, high]`. Use for
 * hyperparameters like layer count, batch size, or hidden units where
 * only whole numbers make sense. Optional `step` controls stride —
 * e.g. `step: 8` restricts batch size to multiples of 8.
 *
 * @see {@link FloatDistributionSchema} — continuous alternative
 * @see {@link DistributionSchema} — the discriminated union containing this variant
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
 * Multi-fidelity budget dimension — a numeric range `[low, high]` that
 * represents a resource axis the optimizer can throttle (e.g. epoch count,
 * image resolution, dataset fraction). Samplers use this to run cheap
 * low-fidelity evaluations early and promote promising configs to full
 * fidelity.
 *
 * Unlike float/int distributions, fidelity has no `step` or `scale` —
 * the scheduler controls progression.
 *
 * @see {@link FloatDistributionSchema} — general continuous parameter
 * @see {@link DistributionSchema} — the discriminated union containing this variant
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
 * Finite unordered choice set. Each element in `choices` is a
 * {@link PrimitiveChoice} — the sampler picks among them without assuming
 * any ordering or distance metric. Use for optimizer, activation function,
 * or any enum-like hyperparameter.
 *
 * @see {@link PrimitiveChoiceSchema} — validates each individual choice value
 * @see {@link DistributionSchema} — the discriminated union containing this variant
 *
 * @since 0.1.0
 * @category schemas
 */
export const CategoricalDistributionSchema = Schema.Struct({
  type: Schema.Literal("categorical"),
  choices: Schema.Array(PrimitiveChoiceSchema)
})

/**
 * Discriminated union of all parameter distribution types, keyed by the
 * `type` field (`"float" | "int" | "fidelity" | "categorical"`).
 * `SearchSpace.make` compiles schemas annotated with these distributions
 * into a structured search space that samplers traverse.
 *
 * @see {@link Distribution} — the extracted type alias
 * @see {@link annotateDistribution} — attaches a distribution to a schema field
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
 * Extracted type of {@link DistributionSchema} — the union of all
 * distribution shapes a search-space parameter can take.
 *
 * @see {@link DistributionSchema} — the runtime schema
 * @see {@link annotateDistribution} — attaches this to a schema field
 *
 * @since 0.1.0
 * @category type-level
 */
export type Distribution = Schema.Schema.Type<typeof DistributionSchema>

/**
 * Schema annotation key for attaching distribution metadata to individual
 * struct fields. The search-space compiler reads this symbol from each
 * field's AST to discover how that parameter should be sampled.
 *
 * Not used directly — prefer {@link annotateDistribution} to attach and
 * {@link readDistribution} to retrieve.
 *
 * @see {@link annotateDistribution} — writes this annotation
 * @see {@link readDistribution} — reads this annotation
 *
 * @since 0.1.0
 * @category utils
 */
export const DistributionKey: unique symbol = Symbol.for("effect-search/Distribution")

/**
 * Attaches a {@link Distribution} to a schema field so that
 * `SearchSpace.make` can discover it during compilation. Each annotated
 * field becomes a named dimension in the resulting search space. Fields
 * without this annotation are treated as fixed (non-tunable) values.
 *
 * @see {@link readDistribution} — retrieves the annotation set here
 * @see {@link DistributionKey} — the underlying annotation symbol
 *
 * @since 0.1.0
 * @category utils
 */
export const annotateDistribution = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  distribution: Distribution
): Schema.Schema<A, I, R> => schema.annotations({ [DistributionKey]: distribution })

/**
 * Retrieves the {@link Distribution} previously attached via
 * {@link annotateDistribution}. Returns `Option.none()` when the AST node
 * has no distribution annotation — the search-space compiler uses this to
 * distinguish tunable fields from fixed ones.
 *
 * @see {@link annotateDistribution} — the write side of this pair
 * @see {@link DistributionKey} — the underlying annotation symbol
 *
 * @since 0.1.0
 * @category utils
 */
export const readDistribution = (ast: SchemaAST.AST): Option.Option<Distribution> =>
  SchemaAST.getAnnotation<Distribution>(DistributionKey)(ast)
