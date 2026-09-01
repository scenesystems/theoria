/**
 * @since 0.1.0
 */
import { Option, Schema } from "effect"
import type { NonEmptyReadonlyArray } from "effect/Array"

import { annotateDistribution } from "../contracts/Distribution.js"
import type { Distribution, PrimitiveChoice } from "../contracts/Distribution.js"
import type { FloatOptions, IntOptions } from "./model.js"

const makeFloatDistribution = (
  low: number,
  high: number,
  options: FloatOptions
): Distribution => {
  const scalePart = Option.fromNullable(options.scale).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (scale) => ({ scale })
    })
  )

  const stepPart = Option.fromNullable(options.step).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (step) => ({ step })
    })
  )

  return {
    type: "float",
    low,
    high,
    ...scalePart,
    ...stepPart
  }
}

const makeIntDistribution = (
  low: number,
  high: number,
  options: IntOptions
): Distribution => {
  const stepPart = Option.fromNullable(options.step).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (step) => ({ step })
    })
  )

  return {
    type: "int",
    low,
    high,
    ...stepPart
  }
}

/**
 * Annotates a number schema as a float distribution. Bounds are inclusive;
 * `scale: "log"` requires a positive lower bound, and `step` must be positive.
 * These constraints are checked when the dimension is passed to {@link make}.
 *
 * @since 0.1.0
 * @category constructors
 */
export const float = (low: number, high: number, options: FloatOptions = {}): Schema.Schema<number> => {
  return annotateDistribution(Schema.Number, makeFloatDistribution(low, high, options))
}

/**
 * Annotates an integer schema with inclusive bounds and an optional positive
 * step. Bounds must be finite integers and are checked by {@link make}.
 *
 * @since 0.1.0
 * @category constructors
 */
export const int = (low: number, high: number, options: IntOptions = {}): Schema.Schema<number> => {
  return annotateDistribution(Schema.Int, makeIntDistribution(low, high, options))
}

/**
 * Annotates an integer schema as a scheduler resource dimension with inclusive
 * bounds. The bounds must be finite integers and are checked by {@link make}.
 *
 * @since 0.1.0
 * @category constructors
 */
export const fidelity = (low: number, high: number): Schema.Schema<number> =>
  annotateDistribution(Schema.Int, {
    type: "fidelity",
    low,
    high
  })

/**
 * Annotates a literal schema with its choices in declaration order. Choices
 * must be a non-empty array of strings, numbers, booleans, or `null`.
 *
 * @since 0.1.0
 * @category constructors
 */
export const categorical = <const Choices extends NonEmptyReadonlyArray<PrimitiveChoice>>(
  choices: Choices
): Schema.Schema<Choices[number]> => {
  return annotateDistribution(
    Schema.Literal(...choices),
    {
      type: "categorical",
      choices
    }
  )
}

/**
 * A categorical dimension whose ordered choices are `true` and `false`.
 *
 * @since 0.1.0
 * @category constructors
 */
export const boolean = (): Schema.Schema<boolean> =>
  annotateDistribution(Schema.Literal(true, false), {
    type: "categorical",
    choices: [true, false]
  })
