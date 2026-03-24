/**
 * @since 0.1.0
 */
import { Array as Arr, Equal, Match, Option, Predicate, Record } from "effect"

import type { PrimitiveChoice } from "../contracts/Distribution.js"
import { ActivationCondition } from "./model.js"
import type { ParameterMetadata, SearchSpace } from "./model.js"

const conditionSatisfied = (config: unknown, condition: ActivationCondition): boolean =>
  Match.value(config).pipe(
    Match.when(Predicate.isRecord, (record) =>
      Option.match(Record.get(record, condition.dimension), {
        onNone: () => false,
        onSome: (value) => Equal.equals(value, condition.equals)
      })),
    Match.orElse(() => false)
  )

/**
 * Check whether a parameter's activation conditions are satisfied.
 *
 * @since 0.1.0
 * @category guards
 */
export const isParameterActive = (parameter: ParameterMetadata, config: unknown): boolean =>
  Arr.every(parameter.activeWhen, (condition) => conditionSatisfied(config, condition))

/**
 * Filter to only active parameters given a configuration.
 *
 * @since 0.1.0
 * @category utils
 */
export const activeParameters = (space: SearchSpace, config: unknown): Array<ParameterMetadata> =>
  Arr.filter(space.params, (parameter) => isParameterActive(parameter, config))

/**
 * Create an activation condition for a branch.
 *
 * @since 0.1.0
 * @category constructors
 */
export const branchCondition = (dimension: string, equals: PrimitiveChoice): ActivationCondition =>
  new ActivationCondition({ dimension, equals })
