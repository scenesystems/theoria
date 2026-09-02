/**
 * Conditional parameter activation against partial configurations.
 *
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
 * Tests every activation condition against a configuration record.
 *
 * @remarks
 * Conditions use Effect structural equality. A missing discriminant or
 * non-record configuration makes a conditional parameter inactive. Parameters
 * with no conditions are always active.
 *
 * @param parameter - Metadata containing the complete outer-to-inner condition path.
 * @param config - Partial or complete configuration inspected for discriminants.
 *
 * @since 0.1.0
 * @category guards
 */
export const isParameterActive = (parameter: ParameterMetadata, config: unknown): boolean =>
  Arr.every(parameter.activeWhen, (condition) => conditionSatisfied(config, condition))

/**
 * Selects active parameter metadata without changing declaration order.
 *
 * @param space - Compiled metadata to filter.
 * @param config - Partial or complete configuration used for condition checks.
 *
 * @since 0.1.0
 * @category combinators
 */
export const activeParameters = (space: SearchSpace, config: unknown): Array<ParameterMetadata> =>
  Arr.filter(space.params, (parameter) => isParameterActive(parameter, config))

/**
 * Requires a branch discriminant to equal `choice` before the parameter is active.
 *
 * @since 0.1.0
 * @category constructors
 */
export const branchCondition = (dimension: string, equals: PrimitiveChoice): ActivationCondition =>
  new ActivationCondition({ dimension, equals })
