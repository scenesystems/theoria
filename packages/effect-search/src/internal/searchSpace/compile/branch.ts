/**
 * Compiler extension that resolves switch-branch declarations into conditional parameter metadata with activation conditions.
 *
 * @since 0.1.0
 */
import { Array as Arr, Boolean as Bool, Effect, HashMap, Number as Num, Option, Record, Schema } from "effect"

import type { Categorical } from "../../../Distribution.js"
import type { Condition, Parameter, SearchSpace, Switch } from "../../../SearchSpace.js"
import { Parameter as ParameterMetadataClass } from "../../../SearchSpace.js"
import { branchCondition } from "../activity.js"
import { expectCondition, invalidSearchSpace } from "../failure.js"
import { ensureDistinctCaseValues, hasChoice } from "../validation.js"

const withPrefixedCondition = (
  parameter: Parameter,
  condition: Condition
): Parameter =>
  new ParameterMetadataClass({
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
    readonly [key: string]: Schema.Schema.AnyNoContext
  },
  BranchSchema extends Schema.Schema.AnyNoContext
>(
  base: {
    readonly schema: Schema.Struct<Dimensions>
    readonly dimensions: HashMap.HashMap<string, Schema.Struct.Field>
    readonly params: SearchSpace["params"]
    readonly knownChoices: HashMap.HashMap<string, Categorical["choices"]>
  },
  branch: Switch<BranchSchema>
) =>
  Effect.gen(function*() {
    yield* expectCondition(
      Num.greaterThan(branch.discriminant.length, 0),
      "switch discriminant must be a non-empty dimension name"
    )
    yield* expectCondition(Num.greaterThan(branch.cases.length, 0), "switch requires at least one branch")

    const cases = yield* ensureDistinctCaseValues(branch.discriminant, branch.cases)
    const discriminantChoices = yield* Option.match(HashMap.get(base.knownChoices, branch.discriminant), {
      onNone: () =>
        Effect.fail(
          invalidSearchSpace(
            `switch(${branch.discriminant}) must reference a previously declared categorical dimension`,
            branch.discriminant
          )
        ),
      onSome: Effect.succeed
    })

    const unreachable = Arr.findFirst(cases, (entry) => Bool.not(hasChoice(discriminantChoices, entry.when)))

    yield* expectCondition(
      Option.isNone(unreachable),
      Option.match(unreachable, {
        onNone: () => "",
        onSome: (entry) =>
          `switch(${branch.discriminant}) branch value "${String(entry.when)}" is unreachable from discriminant choices`
      }),
      branch.discriminant
    )

    const conditionalParams = Arr.flatMap(Arr.fromIterable(cases), (entry) => {
      const condition = branchCondition(branch.discriminant, entry.when)

      return Arr.map(entry.params, (parameter) => withPrefixedCondition(parameter, condition))
    })
    const rootDimensions = HashMap.remove(base.dimensions, branch.discriminant)
    const rootSchema = Schema.Struct(Record.fromEntries(HashMap.entries(rootDimensions)))

    return {
      schema: Schema.extend(rootSchema, branch.schema),
      params: Arr.appendAll(base.params, conditionalParams)
    }
  })
