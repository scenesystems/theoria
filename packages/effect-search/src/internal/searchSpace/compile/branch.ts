/**
 * Compiler extension that resolves switch-branch declarations into conditional parameter metadata with activation conditions.
 *
 * @since 0.1.0
 */
import {
  Array as Arr,
  Boolean as Bool,
  Chunk,
  Effect,
  HashMap,
  Inspectable,
  Number as Num,
  Option,
  Record,
  Schema,
  String as Str
} from "effect"

import type { Categorical } from "../../../Distribution.js"
import { type Condition, Parameter, type SearchSpace, type Switch } from "../../../SearchSpace.js"
import { branchCondition } from "../activity.js"
import { expectCondition, invalidSearchSpace } from "../failure.js"
import { ensureDistinctCaseValues, hasChoice } from "../validation.js"

type SpaceField = Schema.Codec<unknown, unknown, never, never>
type BranchCodec = Schema.Union<ReadonlyArray<Schema.Struct<Readonly<Record<string, SpaceField>>>>>

const withPrefixedCondition = (
  parameter: Parameter,
  condition: Condition
): Parameter =>
  new Parameter({
    name: parameter.name,
    distribution: parameter.distribution,
    activeWhen: Arr.prepend(parameter.activeWhen, condition)
  })

/**
 * Compiles a switch-branch declaration into conditional parameter metadata with activation conditions attached to the base space.
 *
 * @since 0.1.0
 * @category utils
 */
export const compileWithBranch = <
  const Dimensions extends {
    readonly [key: string]: SpaceField
  },
  BranchSchema extends BranchCodec
>(
  base: {
    readonly schema: Schema.Struct<Dimensions>
    readonly dimensions: HashMap.HashMap<string, SpaceField>
    readonly params: SearchSpace["params"]
    readonly knownChoices: HashMap.HashMap<string, Categorical["choices"]>
  },
  branch: Switch<BranchSchema>
) =>
  Effect.gen(function*() {
    yield* expectCondition(
      Num.isGreaterThan(Str.length(branch.discriminant), 0),
      "switch discriminant must be a non-empty dimension name"
    )
    yield* expectCondition(Num.isGreaterThan(Chunk.size(branch.cases), 0), "switch requires at least one branch")

    const cases = yield* ensureDistinctCaseValues(branch.discriminant, branch.cases)
    const discriminantChoices = yield* Effect.fromOption(
      HashMap.get(base.knownChoices, branch.discriminant),
      () =>
        invalidSearchSpace(
          `switch(${branch.discriminant}) must reference a previously declared categorical dimension`,
          branch.discriminant
        )
    )

    const unreachable = Arr.findFirst(cases, (entry) => Bool.not(hasChoice(discriminantChoices, entry.when)))

    yield* expectCondition(
      Option.isNone(unreachable),
      Option.match(unreachable, {
        onNone: () => "",
        onSome: (entry) =>
          `switch(${branch.discriminant}) branch value "${
            Inspectable.toStringUnknown(entry.when)
          }" is unreachable from discriminant choices`
      }),
      branch.discriminant
    )

    const conditionalParams = Arr.flatMap(Arr.fromIterable(cases), (entry) => {
      const condition = branchCondition(branch.discriminant, entry.when)

      return Arr.map(entry.params, (parameter) => withPrefixedCondition(parameter, condition))
    })
    const rootDimensions = HashMap.remove(base.dimensions, branch.discriminant)
    const rootFields = Record.fromEntries(HashMap.entries(rootDimensions))

    return {
      schema: branch.schema.mapMembers((members) =>
        Arr.map(members, (member) => member.pipe(Schema.fieldsAssign(rootFields)))
      ),
      params: Arr.appendAll(base.params, conditionalParams)
    }
  })
