/**
 * @since 0.1.0
 */
import { Array as Arr, Record as Rec, Schema } from "effect"
import type { NonEmptyReadonlyArray } from "effect/Array"

import type { PrimitiveChoice } from "../contracts/Distribution.js"
import type { SearchSpace } from "./model.js"
import { Switch, SwitchCase } from "./model.js"

type BranchCaseType<
  Discriminant extends string,
  CaseSchema extends Schema.Schema.AnyNoContext,
  Choice extends PrimitiveChoice
> =
  & {
    readonly [Key in Discriminant]: Choice
  }
  & Schema.Schema.Type<CaseSchema>

type BranchCaseEncoded<
  Discriminant extends string,
  CaseSchema extends Schema.Schema.AnyNoContext,
  Choice extends PrimitiveChoice
> =
  & {
    readonly [Key in Discriminant]: Choice
  }
  & Schema.Schema.Encoded<CaseSchema>

const branchSchema = <
  Discriminant extends string,
  CaseSchema extends Schema.Schema.AnyNoContext,
  Choice extends PrimitiveChoice
>(
  discriminant: Discriminant,
  entry: SwitchCase<CaseSchema, Choice>
) => {
  const schema = Schema.extend(
    Schema.Struct(Rec.singleton(discriminant, Schema.Literal(entry.when))),
    entry.schema
  )

  return Schema.make<
    BranchCaseType<Discriminant, CaseSchema, Choice>,
    BranchCaseEncoded<Discriminant, CaseSchema, Choice>,
    never
  >(schema.ast)
}

/**
 * Create a switch case binding a value to a sub-space.
 *
 * @since 0.1.0
 * @category constructors
 */
export const when = <
  Choice extends PrimitiveChoice,
  SpaceSchema extends Schema.Schema.AnyNoContext
>(
  value: Choice,
  space: SearchSpace<SpaceSchema>
) => {
  return new SwitchCase<SpaceSchema, Choice>({
    when: value,
    schema: space.schema,
    params: space.params
  })
}

/**
 * Create a conditional switch over a discriminant dimension.
 *
 * @since 0.1.0
 * @category constructors
 */
export const switchOn = <
  Discriminant extends string,
  const Cases extends NonEmptyReadonlyArray<SwitchCase>
>(
  discriminant: Discriminant,
  cases: Cases
) => {
  const runtimeSchema = Arr.reduce(
    Arr.drop(cases, 1),
    branchSchema(discriminant, cases[0]),
    (current, entry) => Schema.Union(current, branchSchema(discriminant, entry))
  )

  const schema = Schema.make<
    Cases[number] extends infer Case
      ? Case extends SwitchCase<infer CaseSchema, infer Choice> ? BranchCaseType<Discriminant, CaseSchema, Choice>
      : never
      : never,
    Cases[number] extends infer Case
      ? Case extends SwitchCase<infer CaseSchema, infer Choice> ? BranchCaseEncoded<Discriminant, CaseSchema, Choice>
      : never
      : never,
    never
  >(runtimeSchema.ast)

  return new Switch<typeof schema, Cases[number], Discriminant>({
    discriminant,
    cases,
    schema
  })
}

export {
  /**
   * @since 0.1.0
   * @category constructors
   */
  switchOn as switch
}
