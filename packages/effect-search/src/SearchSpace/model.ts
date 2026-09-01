/**
 * @since 0.1.0
 */
import { Data, Schema } from "effect"
import type { HashMap } from "effect"
import type { NonEmptyReadonlyArray } from "effect/Array"

import type { PrimitiveChoice } from "../contracts/Distribution.js"
import { DistributionSchema, PrimitiveChoiceSchema } from "../contracts/Distribution.js"

/**
 * Schema for optional float distribution metadata. `scale` records linear or
 * logarithmic sampling and `step` records discretization; {@link make} validates
 * positive steps and positive lower bounds for logarithmic dimensions.
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
 * Decoded options accepted by {@link float}.
 *
 * @see {@link FloatOptionsSchema}
 * @since 0.1.0
 * @category type-level
 */
export type FloatOptions = Schema.Schema.Type<typeof FloatOptionsSchema>

/**
 * Schema for an optional integer distribution step. {@link make} requires a
 * supplied step to be positive.
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
 * Decoded options accepted by {@link int}.
 *
 * @see {@link IntOptionsSchema}
 * @since 0.1.0
 * @category type-level
 */
export type IntOptions = Schema.Schema.Type<typeof IntOptionsSchema>

/**
 * An equality requirement on a named discriminant. All conditions attached to
 * a parameter must hold for that parameter to be active.
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
 * Sampling metadata extracted from one annotated dimension. `activeWhen` is
 * empty for root parameters and records the outer-to-inner activation path for
 * branch parameters.
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
 * A discriminant value together with the branch schema and its ordered metadata.
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
 * A named discriminant, non-empty case list, and union schema assembled by
 * {@link switchOn}. Reachability and uniqueness are validated during compilation.
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
 * A compiled configuration schema, source-dimension lookup, and ordered
 * parameter metadata. The schema determines decoded and encoded config types.
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
 * Configuration delivered to objectives after the compiled schema decodes a
 * sampler suggestion.
 *
 * @see {@link SearchSpace}
 * @see {@link Encoded} for the serialized counterpart
 * @since 0.1.0
 * @category type-level
 */
export type Type<Space extends SearchSpace = SearchSpace> = Schema.Schema.Type<Space["schema"]>

/**
 * Portable representation crossing the compiled space's serialization boundary.
 *
 * @see {@link SearchSpace}
 * @see {@link Type} for the decoded counterpart
 * @since 0.1.0
 * @category type-level
 */
export type Encoded<Space extends SearchSpace = SearchSpace> = Schema.Schema.Encoded<Space["schema"]>
