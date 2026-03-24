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
 * Define a continuous float dimension with bounds and optional scale/step.
 *
 * @since 0.1.0
 * @category constructors
 */
export const float = (low: number, high: number, options: FloatOptions = {}): Schema.Schema<number> => {
  return annotateDistribution(Schema.Number, makeFloatDistribution(low, high, options))
}

/**
 * Define an integer dimension with bounds and optional step.
 *
 * @since 0.1.0
 * @category constructors
 */
export const int = (low: number, high: number, options: IntOptions = {}): Schema.Schema<number> => {
  return annotateDistribution(Schema.Int, makeIntDistribution(low, high, options))
}

/**
 * Define an integer fidelity/resource dimension consumed by schedulers.
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
 * Define a categorical dimension from a non-empty array of choices.
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
 * Define a boolean dimension (sugar for `categorical([true, false])`).
 *
 * @since 0.1.0
 * @category constructors
 */
export const boolean = (): Schema.Schema<boolean> =>
  annotateDistribution(Schema.Literal(true, false), {
    type: "categorical",
    choices: [true, false]
  })
