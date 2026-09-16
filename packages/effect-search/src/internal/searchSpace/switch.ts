/**
 * Conditional branch construction from compiled case spaces.
 *
 * @since 0.1.0
 */
import { Array as Arr, Chunk, Record as Rec, Schema } from "effect"

import type { Choice } from "../../Distribution.js"
import type { SearchSpace } from "../../SearchSpace.js"
import { Case, Switch } from "../../SearchSpace.js"

type BranchCaseType<
  Discriminant extends string,
  CaseSchema extends Schema.Schema.AnyNoContext,
  ChoiceValue extends Choice
> =
  & {
    readonly [Key in Discriminant]: ChoiceValue
  }
  & Schema.Schema.Type<CaseSchema>

type BranchCaseEncoded<
  Discriminant extends string,
  CaseSchema extends Schema.Schema.AnyNoContext,
  ChoiceValue extends Choice
> =
  & {
    readonly [Key in Discriminant]: ChoiceValue
  }
  & Schema.Schema.Encoded<CaseSchema>

const branchSchema = <
  Discriminant extends string,
  CaseSchema extends Schema.Schema.AnyNoContext,
  ChoiceValue extends Choice
>(
  discriminant: Discriminant,
  entry: Case<CaseSchema, ChoiceValue>
) => {
  const schema = Schema.extend(
    Schema.Struct(Rec.singleton(discriminant, Schema.Literal(entry.when))),
    entry.schema
  )

  return Schema.make<
    BranchCaseType<Discriminant, CaseSchema, ChoiceValue>,
    BranchCaseEncoded<Discriminant, CaseSchema, ChoiceValue>,
    never
  >(schema.ast)
}

/**
 * Binds one categorical discriminant value to a compiled branch space.
 *
 * @remarks
 * The case retains the branch schema and parameter metadata by reference. Case
 * reachability and duplicate values are checked by {@link makeConditional}.
 *
 * @typeParam Choice - Literal value used to select this case.
 * @typeParam SpaceSchema - Decoded and encoded contract for the branch fields.
 * @param value - Primitive value present in the discriminant's categorical choices.
 * @param space - Already compiled fields active for this case.
 *
 * @since 0.1.0
 * @category constructors
 */
export const when = <
  ChoiceValue extends Choice,
  SpaceSchema extends Schema.Schema.AnyNoContext
>(
  value: ChoiceValue,
  space: SearchSpace<SpaceSchema>
) => {
  return new Case<SpaceSchema, ChoiceValue>({
    when: value,
    schema: space.schema,
    params: space.params
  })
}

/**
 * Builds a union whose members combine a discriminant literal with one case schema.
 *
 * @remarks
 * Case order determines union and metadata order. This operation does not check
 * that the discriminant exists, is categorical, or can reach each case;
 * {@link makeConditional} performs those checks.
 *
 * @typeParam Discriminant - Literal root parameter name selecting a case.
 * @typeParam Cases - Non-empty tuple whose branch schemas form the union.
 * @param discriminant - Root categorical parameter included in every union member.
 * @param cases - Ordered compiled cases.
 *
 * @since 0.1.0
 * @category constructors
 */
export const switchOn = <
  Discriminant extends string,
  const BranchCase extends Case
>(
  discriminant: Discriminant,
  cases: Chunk.NonEmptyChunk<BranchCase>
) => {
  const runtimeSchema = Arr.reduce(
    Chunk.drop(cases, 1),
    branchSchema(discriminant, Chunk.headNonEmpty(cases)),
    (current, entry) => Schema.Union(current, branchSchema(discriminant, entry))
  )

  const schema = Schema.make<
    BranchCase extends Case<infer CaseSchema, infer ChoiceValue> ? BranchCaseType<Discriminant, CaseSchema, ChoiceValue>
      : never,
    BranchCase extends Case<infer CaseSchema, infer ChoiceValue> ?
      BranchCaseEncoded<Discriminant, CaseSchema, ChoiceValue>
      : never,
    never
  >(runtimeSchema.ast)

  return new Switch<typeof schema, BranchCase, Discriminant>({
    discriminant,
    cases,
    schema
  })
}
