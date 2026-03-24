/**
 * Validation rules for search space distributions, parameter uniqueness, and switch-case distinctness.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Equal, Match, Option } from "effect"
import type { NonEmptyReadonlyArray } from "effect/Array"

import type { Distribution, PrimitiveChoice } from "../contracts/Distribution.js"
import type { InvalidSearchSpace } from "../Errors/index.js"
import { expectCondition } from "./failure.js"
import { ensurePrimitiveChoice } from "./guards.js"
import type { ParameterMetadata, SwitchCase } from "./model.js"

/**
 * Fails with InvalidSearchSpace if the value is not a finite number.
 *
 * @since 0.1.0
 * @category utils
 */
export const ensureFiniteNumber = (value: number, label: string): Effect.Effect<void, InvalidSearchSpace> =>
  expectCondition(Number.isFinite(value), `${label} must be a finite number`)

/**
 * Fails with InvalidSearchSpace if the optional step value is present but not positive.
 *
 * @since 0.1.0
 * @category utils
 */
export const ensurePositiveStep = (
  step: Option.Option<number>,
  dimension: string
): Effect.Effect<void, InvalidSearchSpace> =>
  Option.match(step, {
    onNone: () => Effect.void,
    onSome: (value) => expectCondition(value > 0, "step must be greater than 0", dimension)
  })

/**
 * Reports whether a categorical choices array contains a given value using structural equality.
 *
 * @since 0.1.0
 * @category guards
 */
export const hasChoice = (choices: ReadonlyArray<PrimitiveChoice>, value: PrimitiveChoice): boolean =>
  Arr.some(choices, (choice) => Equal.equals(choice, value))

const validateFloatDistribution = (
  dimension: string,
  low: number,
  high: number,
  scale: Option.Option<"linear" | "log">,
  step: Option.Option<number>
): Effect.Effect<void, InvalidSearchSpace> =>
  Effect.gen(function*() {
    yield* ensureFiniteNumber(low, `${dimension}.low`)
    yield* ensureFiniteNumber(high, `${dimension}.high`)
    yield* ensurePositiveStep(step, dimension)
    yield* expectCondition(low <= high, "float low cannot be greater than high", dimension)

    yield* Option.match(scale, {
      onNone: () => Effect.void,
      onSome: (s) =>
        Match.value(s).pipe(
          Match.when("log", () => expectCondition(low > 0, "log-scaled float dimensions require low > 0", dimension)),
          Match.orElse(() => Effect.void)
        )
    })
  })

const validateIntDistribution = (
  dimension: string,
  low: number,
  high: number,
  step: Option.Option<number>
): Effect.Effect<void, InvalidSearchSpace> =>
  Effect.gen(function*() {
    yield* ensureFiniteNumber(low, `${dimension}.low`)
    yield* ensureFiniteNumber(high, `${dimension}.high`)
    yield* ensurePositiveStep(step, dimension)
    yield* expectCondition(Number.isInteger(low) && Number.isInteger(high), "int bounds must be integers", dimension)
    yield* expectCondition(low <= high, "int low cannot be greater than high", dimension)
  })

const validateCategoricalDistribution = (
  dimension: string,
  choices: ReadonlyArray<PrimitiveChoice>
): Effect.Effect<void, InvalidSearchSpace> =>
  Effect.gen(function*() {
    yield* expectCondition(choices.length > 0, "categorical choices must be non-empty", dimension)
    yield* Effect.forEach(choices, (choice) => ensurePrimitiveChoice(choice), { discard: true })
  })

/**
 * Validates a distribution's bounds, step, scale, and choices according to its type (float, int, fidelity, categorical).
 *
 * @since 0.1.0
 * @category utils
 */
export const validateDistribution = (
  dimension: string,
  distribution: Distribution
): Effect.Effect<void, InvalidSearchSpace> =>
  Match.value(distribution).pipe(
    Match.when({ type: "float" }, ({ low, high, scale, step }) =>
      validateFloatDistribution(dimension, low, high, Option.fromNullable(scale), Option.fromNullable(step))),
    Match.when({ type: "int" }, ({ low, high, step }) =>
      validateIntDistribution(dimension, low, high, Option.fromNullable(step))),
    Match.when({ type: "fidelity" }, ({ low, high }) =>
      validateIntDistribution(dimension, low, high, Option.none())),
    Match.when({ type: "categorical" }, ({ choices }) =>
      validateCategoricalDistribution(dimension, choices)),
    Match.exhaustive
  )

const duplicateParameterName = (parameters: Array<ParameterMetadata>): Option.Option<string> =>
  Option.map(
    Arr.findFirst(parameters, (parameter, index) =>
      Arr.some(Arr.drop(parameters, index + 1), (candidate) =>
        Equal.equals(candidate.name, parameter.name))),
    (parameter) =>
      parameter.name
  )

/**
 * Fails with InvalidSearchSpace if any parameter name appears more than once in the metadata array.
 *
 * @since 0.1.0
 * @category utils
 */
export const ensureUniqueParameterNames = (
  parameters: Array<ParameterMetadata>
): Effect.Effect<Array<ParameterMetadata>, InvalidSearchSpace> => {
  const duplicate = duplicateParameterName(parameters)

  return expectCondition(
    Option.isNone(duplicate),
    Option.match(duplicate, {
      onNone: () => "",
      onSome: (name) =>
        `parameter "${name}" is declared more than once; conditional parameters must be declared exactly once`
    })
  ).pipe(Effect.as(parameters))
}

/**
 * Fails with InvalidSearchSpace if any switch-case branch value is duplicated for the given discriminant.
 *
 * @since 0.1.0
 * @category utils
 */
export const ensureDistinctCaseValues = (
  discriminant: string,
  cases: NonEmptyReadonlyArray<SwitchCase>
): Effect.Effect<NonEmptyReadonlyArray<SwitchCase>, InvalidSearchSpace> => {
  const duplicate = Arr.findFirst(
    cases,
    (current, index) => Arr.some(Arr.drop(cases, index + 1), (candidate) => Equal.equals(candidate.when, current.when))
  )

  return expectCondition(
    Option.isNone(duplicate),
    Option.match(duplicate, {
      onNone: () => "",
      onSome: (entry) =>
        `switch(${discriminant}) has duplicate branch value "${String(entry.when)}"; branch values must be unique`
    }),
    discriminant
  ).pipe(Effect.as(cases))
}
