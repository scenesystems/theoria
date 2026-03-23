/**
 * Compiler extension that resolves switch-branch declarations into conditional parameter metadata with activation conditions.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, HashMap, Option, Record, Schema } from "effect"

import type { PrimitiveChoice } from "../../contracts/Distribution.js"
import type { InvalidSearchSpace } from "../../Errors/index.js"
import { branchCondition } from "../activity.js"
import { expectCondition, invalidSearchSpace } from "../failure.js"
import type { ActivationCondition, ParameterMetadata, Switch } from "../model.js"
import { ParameterMetadata as ParameterMetadataClass } from "../model.js"
import { ensureDistinctCaseValues, hasChoice } from "../validation.js"

const withPrefixedCondition = (
  parameter: ParameterMetadata,
  condition: ActivationCondition
): ParameterMetadata =>
  new ParameterMetadataClass({
    name: parameter.name,
    distribution: parameter.distribution,
    activeWhen: [condition, ...parameter.activeWhen]
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
    readonly params: Array<ParameterMetadata>
    readonly knownChoices: HashMap.HashMap<string, ReadonlyArray<PrimitiveChoice>>
  },
  branch: Switch<BranchSchema>
): Effect.Effect<{
  readonly schema: Schema.Schema.Any
  readonly params: Array<ParameterMetadata>
}, InvalidSearchSpace> =>
  Effect.gen(function*() {
    yield* expectCondition(branch.discriminant.length > 0, "switch discriminant must be a non-empty dimension name")
    yield* expectCondition(branch.cases.length > 0, "switch requires at least one branch")

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

    const unreachable = Arr.findFirst(cases, (entry) => !hasChoice(discriminantChoices, entry.when))

    yield* expectCondition(
      Option.isNone(unreachable),
      Option.match(unreachable, {
        onNone: () => "",
        onSome: (entry) =>
          `switch(${branch.discriminant}) branch value "${String(entry.when)}" is unreachable from discriminant choices`
      }),
      branch.discriminant
    )

    const conditionalParams = Arr.flatMap(cases, (entry) => {
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
