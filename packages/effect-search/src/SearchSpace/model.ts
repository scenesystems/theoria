/**
 * @since 0.1.0
 */
import { Data, Schema } from "effect"
import type { HashMap } from "effect"
import type { NonEmptyReadonlyArray } from "effect/Array"

import type { PrimitiveChoice } from "../contracts/Distribution.js"
import { DistributionSchema, PrimitiveChoiceSchema } from "../contracts/Distribution.js"

/**
 * Options for float-valued dimensions. `scale: "log"` enables log-uniform
 * sampling — essential for parameters spanning orders of magnitude (e.g.
 * learning rate 1e-5 to 1e-1). `step` discretizes the continuous range
 * into evenly spaced increments.
 *
 * @see {@link IntOptionsSchema} for integer-valued dimensions
 * @see {@link ParameterMetadata} where these options feed into compiled metadata
 * @since 0.1.0
 * @category schemas
 */
export const FloatOptionsSchema = Schema.Struct({
  scale: Schema.optional(Schema.Literal("linear", "log")),
  step: Schema.optional(Schema.Number)
})

/**
 * Inferred runtime type of {@link FloatOptionsSchema}.
 *
 * @see {@link FloatOptionsSchema}
 * @since 0.1.0
 * @category type-level
 */
export type FloatOptions = Schema.Schema.Type<typeof FloatOptionsSchema>

/**
 * Options for integer-valued dimensions. `step` constrains sampling to
 * multiples of the given value (e.g. `step: 8` for attention head counts
 * that must be powers-of-two-friendly).
 *
 * @see {@link FloatOptionsSchema} for float-valued dimensions
 * @see {@link ParameterMetadata} where these options feed into compiled metadata
 * @since 0.1.0
 * @category schemas
 */
export const IntOptionsSchema = Schema.Struct({
  step: Schema.optional(Schema.Number)
})

/**
 * Inferred runtime type of {@link IntOptionsSchema}.
 *
 * @see {@link IntOptionsSchema}
 * @since 0.1.0
 * @category type-level
 */
export type IntOptions = Schema.Schema.Type<typeof IntOptionsSchema>

/**
 * Predicate that gates a dimension's participation in the search space.
 * A dimension with an activation condition is only sampled when the
 * named discriminant dimension currently equals the specified value.
 * This enables conditional search spaces where entire parameter groups
 * appear or disappear based on a categorical choice.
 *
 * @see {@link Switch} which uses activation conditions to branch sub-schemas
 * @see {@link ParameterMetadata} which carries the `activeWhen` array
 * @since 0.1.0
 * @category models
 */
export class ActivationCondition extends Schema.Class<ActivationCondition>("effect-search/ActivationCondition")({
  dimension: Schema.String,
  equals: PrimitiveChoiceSchema
}) {}

/**
 * Compiled representation of a single searchable dimension, extracted from
 * an annotated Schema field during `SearchSpace.make()`. Pairs the
 * dimension's sampling distribution with any activation conditions that
 * gate its participation in conditional spaces.
 *
 * @see {@link ActivationCondition} for conditional dimension gating
 * @see {@link SearchSpace} which aggregates all parameter metadata
 * @since 0.1.0
 * @category models
 */
export class ParameterMetadata extends Schema.Class<ParameterMetadata>("effect-search/ParameterMetadata")({
  name: Schema.String,
  distribution: DistributionSchema,
  activeWhen: Schema.Array(ActivationCondition)
}) {}

/**
 * Binds a discriminant value to a sub-schema and its extracted parameters.
 * `CaseSchema` is the schema active when the discriminant matches `Choice`,
 * and `params` holds the pre-compiled metadata for that branch so samplers
 * can iterate without re-extracting at runtime.
 *
 * @see {@link Switch} which collects cases into a branching structure
 * @see {@link ActivationCondition} which mirrors this binding at the dimension level
 * @since 0.1.0
 * @category models
 */
export class SwitchCase<
  CaseSchema extends Schema.Schema.AnyNoContext = Schema.Schema.AnyNoContext,
  Choice extends PrimitiveChoice = PrimitiveChoice
> extends Data.TaggedClass("SwitchCase")<{
  readonly when: Choice
  readonly schema: CaseSchema
  readonly params: Array<ParameterMetadata>
}> {}

/**
 * Categorical branching point in a search space where different values
 * of a discriminant dimension activate entirely different parameter sets.
 * The `discriminant` names the categorical dimension, and each `SwitchCase`
 * maps one of its values to a sub-schema with its own dimensions. Samplers
 * first sample the discriminant, then recurse into the matching case.
 *
 * @see {@link SwitchCase} for individual branch bindings
 * @see {@link SearchSpace} which may contain switches as part of its structure
 * @since 0.1.0
 * @category models
 */
export class Switch<
  BranchSchema extends Schema.Schema.AnyNoContext = Schema.Schema.AnyNoContext,
  Case extends SwitchCase = SwitchCase,
  Discriminant extends string = string
> extends Data.TaggedClass("Switch")<{
  readonly discriminant: Discriminant
  readonly cases: NonEmptyReadonlyArray<Case>
  readonly schema: BranchSchema
}> {}

/**
 * Immutable, compiled output of `SearchSpace.make()` — the central type
 * consumed by all Sampler algorithms. `dimensions` is a `HashMap` for O(1)
 * lookup by name, `params` holds the pre-extracted metadata for every
 * searchable dimension, and `schema` provides decode/encode for sampled
 * configurations. Construct once, sample many times.
 *
 * @see {@link ParameterMetadata} for individual dimension metadata
 * @see {@link Type} to extract the decoded config type
 * @see {@link Encoded} to extract the serialized config type
 * @since 0.1.0
 * @category models
 */
export class SearchSpace<SpaceSchema extends Schema.Schema.AnyNoContext = Schema.Schema.AnyNoContext>
  extends Data.Class<{
    readonly schema: SpaceSchema
    readonly dimensions: HashMap.HashMap<string, Schema.Struct.Field>
    readonly params: Array<ParameterMetadata>
  }>
{}

/**
 * Extracts the decoded runtime config type from a SearchSpace. Use this
 * to type variables that hold sampled configurations.
 *
 * @see {@link SearchSpace}
 * @see {@link Encoded} for the serialized counterpart
 * @since 0.1.0
 * @category type-level
 */
export type Type<Space extends SearchSpace = SearchSpace> = Schema.Schema.Type<Space["schema"]>

/**
 * Extracts the wire-format (encoded) config type from a SearchSpace. Use
 * this to type serialized trial configurations stored in databases or logs.
 *
 * @see {@link SearchSpace}
 * @see {@link Type} for the decoded counterpart
 * @since 0.1.0
 * @category type-level
 */
export type Encoded<Space extends SearchSpace = SearchSpace> = Schema.Schema.Encoded<Space["schema"]>
