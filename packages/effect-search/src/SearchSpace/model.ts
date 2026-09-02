/**
 * Runtime models and type projections for compiled search spaces.
 *
 * @since 0.1.0
 */
import { Data, Schema } from "effect"
import type { HashMap } from "effect"
import type { NonEmptyReadonlyArray } from "effect/Array"

import type { PrimitiveChoice } from "../contracts/Distribution.js"
import { DistributionSchema, PrimitiveChoiceSchema } from "../contracts/Distribution.js"

/**
 * Decodes optional scale and quantization metadata for a float distribution.
 *
 * @remarks
 * This schema checks field shape only. Search-space compilation validates step
 * positivity and the logarithmic lower bound.
 * @since 0.1.0
 * @category schemas
 */
export const FloatOptionsSchema = Schema.Struct({
  scale: Schema.optional(Schema.Literal("linear", "log")),
  step: Schema.optional(Schema.Number)
})

/**
 * Configures linear or logarithmic float sampling and optional quantization.
 * @since 0.1.0
 * @category type-level
 */
export type FloatOptions = Schema.Schema.Type<typeof FloatOptionsSchema>

/**
 * Decodes an optional integer-distribution sampling step.
 *
 * @remarks
 * This schema accepts any number. Search-space compilation requires a positive
 * value when the field is present.
 * @since 0.1.0
 * @category schemas
 */
export const IntOptionsSchema = Schema.Struct({
  step: Schema.optional(Schema.Number)
})

/**
 * Configures the positive sampling step for an integer dimension.
 * @since 0.1.0
 * @category type-level
 */
export type IntOptions = Schema.Schema.Type<typeof IntOptionsSchema>

/**
 * Requires one named discriminant to equal a primitive value for activation.
 *
 * @remarks
 * Conditions use Effect structural equality.
 * @since 0.1.0
 * @category models
 */
export class ActivationCondition extends Schema.Class<ActivationCondition>("effect-search/ActivationCondition")({
  /** Name of a categorical parameter earlier in the activation path. */
  dimension: Schema.String,
  /** Branch value that activates the dependent parameter. */
  equals: PrimitiveChoiceSchema
}) {}

/**
 * Records a named sampler distribution and its complete activation path.
 * @since 0.1.0
 * @category models
 */
export class ParameterMetadata extends Schema.Class<ParameterMetadata>("effect-search/ParameterMetadata")({
  /** Configuration key used by samplers and schema fields. */
  name: Schema.String,
  /** Sampling bounds, choices, scale, and step for the parameter. */
  distribution: DistributionSchema,
  /** Outer-to-inner branch conditions; empty for root parameters. */
  activeWhen: Schema.Array(ActivationCondition)
}) {}

/**
 * Binds one discriminant value to an already compiled branch space.
 *
 * @typeParam CaseSchema - Schema decoded when this case is selected.
 * @typeParam Choice - Literal discriminant value selecting the case.
 * @since 0.1.0
 * @category models
 */
export class SwitchCase<
  CaseSchema extends Schema.Schema.AnyNoContext = Schema.Schema.AnyNoContext,
  Choice extends PrimitiveChoice = PrimitiveChoice
> extends Data.TaggedClass("SwitchCase")<{
  /** Discriminant value selecting this case. */
  readonly when: Choice
  /** Compiled branch schema, excluding the outer discriminant field. */
  readonly schema: CaseSchema
  /** Branch parameter metadata in declaration order. */
  readonly params: Array<ParameterMetadata>
}> {}

/**
 * Describes a conditional union selected by a named categorical dimension.
 *
 * @remarks
 * {@link switchOn} constructs the union schema immediately. Reachability,
 * duplicate case values, and the discriminant's presence are validated later by
 * {@link makeConditional}.
 *
 * @typeParam BranchSchema - Union schema containing the discriminant and case fields.
 * @typeParam Case - Case record included in the union.
 * @typeParam Discriminant - Literal configuration key that selects a case.
 * @since 0.1.0
 * @category models
 */
export class Switch<
  BranchSchema extends Schema.Schema.AnyNoContext = Schema.Schema.AnyNoContext,
  Case extends SwitchCase = SwitchCase,
  Discriminant extends string = string
> extends Data.TaggedClass("Switch")<{
  /** Root categorical parameter used to select the branch. */
  readonly discriminant: Discriminant
  /** Ordered non-empty case list. */
  readonly cases: NonEmptyReadonlyArray<Case>
  /** Union schema containing one member per case. */
  readonly schema: BranchSchema
}> {}

/**
 * Couples a configuration schema with the metadata required by samplers.
 *
 * @remarks
 * For conditional spaces, `dimensions` contains root declarations only; branch
 * dimensions remain available through `schema` and `params`.
 *
 * @typeParam SpaceSchema - Schema defining decoded objective input and encoded representation.
 * @since 0.1.0
 * @category models
 */
export class SearchSpace<SpaceSchema extends Schema.Schema.AnyNoContext = Schema.Schema.AnyNoContext>
  extends Data.Class<{
    /** Decodes sampler output and determines the configuration type. */
    readonly schema: SpaceSchema
    /** Root dimension schemas keyed by parameter name. */
    readonly dimensions: HashMap.HashMap<string, Schema.Struct.Field>
    /** All root and branch sampling metadata in compilation order. */
    readonly params: Array<ParameterMetadata>
  }>
{}

/**
 * Extracts the configuration delivered to an objective after schema decoding.
 *
 * @typeParam Space - Compiled space whose decoded schema type is selected.
 * @since 0.1.0
 * @category type-level
 */
export type Type<Space extends SearchSpace = SearchSpace> = Schema.Schema.Type<Space["schema"]>

/**
 * Extracts the representation accepted by the space schema's decoder.
 *
 * @typeParam Space - Compiled space whose encoded schema type is selected.
 * @since 0.1.0
 * @category type-level
 */
export type Encoded<Space extends SearchSpace = SearchSpace> = Schema.Schema.Encoded<Space["schema"]>
