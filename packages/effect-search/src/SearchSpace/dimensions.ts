/**
 * Schema annotations that describe sampler distributions.
 *
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
 * Attaches an inclusive floating-point sampling distribution to `Schema.Number`.
 *
 * @remarks
 * Compilation requires finite ordered bounds, a positive step when present, and
 * a positive lower bound for logarithmic sampling. The resulting config schema
 * still decodes any number; bounds and steps constrain sampler output rather
 * than untrusted input.
 *
 * @param low - Inclusive sampling lower bound.
 * @param high - Inclusive sampling upper bound.
 * @param options - Linear or logarithmic scale and optional quantization step.
 *
 * @since 0.1.0
 * @category constructors
 */
export const float = (low: number, high: number, options: FloatOptions = {}): Schema.Schema<number> => {
  return annotateDistribution(Schema.Number, makeFloatDistribution(low, high, options))
}

/**
 * Attaches an inclusive integer sampling distribution to `Schema.Int`.
 *
 * @remarks
 * Compilation requires finite ordered integer bounds and a positive step when
 * present. Decoding checks integer shape but does not enforce bounds or step
 * alignment.
 *
 * @param low - Inclusive integer sampling lower bound.
 * @param high - Inclusive integer sampling upper bound.
 * @param options - Optional positive sampling step.
 *
 * @since 0.1.0
 * @category constructors
 */
export const int = (low: number, high: number, options: IntOptions = {}): Schema.Schema<number> => {
  return annotateDistribution(Schema.Int, makeIntDistribution(low, high, options))
}

/**
 * Attaches an inclusive scheduler-resource distribution to `Schema.Int`.
 *
 * @remarks
 * Compilation requires finite ordered integer bounds. Decoding checks integer
 * shape but does not enforce the resource range. During scheduled studies, the
 * active round's resource is also available from `ObjectiveTrialRuntime.resource`.
 *
 * @param low - Inclusive minimum resource.
 * @param high - Inclusive maximum resource.
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
 * Creates a literal schema and categorical sampling distribution from ordered choices.
 *
 * @remarks
 * Compilation requires at least one primitive choice and rejects non-finite
 * numeric choices. Duplicate choices remain in distribution metadata and occupy
 * separate sampling positions.
 *
 * @typeParam Choices - Non-empty tuple whose members define the decoded literal union.
 * @param choices - Ordered primitive values accepted by the schema.
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
 * Creates a boolean schema sampled in `[true, false]` order.
 *
 * @since 0.1.0
 * @category constructors
 */
export const boolean = (): Schema.Schema<boolean> =>
  annotateDistribution(Schema.Literal(true, false), {
    type: "categorical",
    choices: [true, false]
  })
