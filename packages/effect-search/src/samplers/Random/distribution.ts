/**
 * Random distribution sampling — draws values from categorical, integer, and float distributions.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Match, Number as Num, Option } from "effect"

import type { Distribution } from "../../contracts/Distribution.js"
import { InvalidSamplerConfig } from "../../Errors/index.js"
import * as Float64 from "../../internal/float64.js"
import * as Rng from "../../internal/rng.js"

const quantize = (value: number, low: number, high: number, step: number): number => {
  const steps = Num.round((value - low) / step, 0)
  const snapped = low + steps * step

  return Num.clamp(snapped, {
    minimum: low,
    maximum: high
  })
}

const stepOr = (step: Option.Option<number>, fallback: number): number => Option.getOrElse(step, () => fallback)

const categoricalChoices = (
  choices: ReadonlyArray<unknown>
): Effect.Effect<ReadonlyArray<unknown>, InvalidSamplerConfig> =>
  Match.value(Num.greaterThan(choices.length, 0)).pipe(
    Match.when(true, () => Effect.succeed(choices)),
    Match.orElse(() =>
      Effect.fail(
        new InvalidSamplerConfig({
          reason: "categorical distribution must have at least one choice",
          sampler: "random"
        })
      )
    )
  )

const sampledCategoricalAt = (
  choices: ReadonlyArray<unknown>,
  index: number
): Effect.Effect<unknown, InvalidSamplerConfig> =>
  Arr.get(choices, index).pipe(
    Option.match({
      onNone: () =>
        Effect.fail(
          new InvalidSamplerConfig({
            reason: "random categorical index resolved outside available choices",
            sampler: "random"
          })
        ),
      onSome: Effect.succeed
    })
  )

const sampleCategorical = (
  rng: Rng.Rng,
  choices: ReadonlyArray<unknown>
): Effect.Effect<unknown, InvalidSamplerConfig> =>
  categoricalChoices(choices).pipe(
    Effect.flatMap((resolvedChoices) =>
      Rng.nextInt(rng, 0, resolvedChoices.length - 1).pipe(
        Effect.flatMap((index) => sampledCategoricalAt(resolvedChoices, index))
      )
    )
  )

const sampleInt = (
  rng: Rng.Rng,
  low: number,
  high: number,
  step: Option.Option<number>
): Effect.Effect<number> => {
  const stride = stepOr(step, 1)

  return Rng.nextInt(rng, low, high).pipe(
    Effect.map((value) => quantize(value, low, high, stride))
  )
}

const sampleLinearFloat = (
  rng: Rng.Rng,
  low: number,
  high: number,
  step: Option.Option<number>
): Effect.Effect<number> =>
  Rng.nextFloat(rng, low, high).pipe(
    Effect.map((value) =>
      Option.match(step, {
        onNone: () => value,
        onSome: (stride) => quantize(value, low, high, stride)
      })
    )
  )

const sampleLogFloat = (
  rng: Rng.Rng,
  low: number,
  high: number,
  step: Option.Option<number>
): Effect.Effect<number, InvalidSamplerConfig> =>
  Match.value(Num.lessThanOrEqualTo(low, 0) || Num.lessThanOrEqualTo(high, 0)).pipe(
    Match.when(
      true,
      () =>
        Effect.fail(
          new InvalidSamplerConfig({
            reason: "log-scale random sampling requires low > 0 and high > 0",
            sampler: "random"
          })
        )
    ),
    Match.orElse(() => {
      const logLow = Float64.log(low)
      const logHigh = Float64.log(high)

      return Rng.nextFloat(rng, logLow, logHigh).pipe(
        Effect.map((raw) => Float64.exp(raw)),
        Effect.map((value) =>
          Option.match(step, {
            onNone: () => value,
            onSome: (stride) => quantize(value, low, high, stride)
          })
        )
      )
    })
  )

const sampleFloat = (
  rng: Rng.Rng,
  low: number,
  high: number,
  scale: Option.Option<"linear" | "log">,
  step: Option.Option<number>
): Effect.Effect<number, InvalidSamplerConfig> =>
  Option.match(scale, {
    onNone: () => sampleLinearFloat(rng, low, high, step),
    onSome: (s) =>
      Match.value(s).pipe(
        Match.when("log", () => sampleLogFloat(rng, low, high, step)),
        Match.orElse(() => sampleLinearFloat(rng, low, high, step))
      )
  })

/**
 * Draws a single random value from a categorical, integer, fidelity, or float
 * distribution using the provided RNG, respecting optional step quantization
 * and log scaling.
 *
 * Dispatches to the appropriate type-specific sampler (uniform choice,
 * uniform integer, or uniform/log-uniform float).
 *
 * @see {@link sampleParameters} for the parameter-level orchestration
 * @since 0.1.0
 * @category sampling
 */
export const sampleDistribution = (
  rng: Rng.Rng,
  distribution: Distribution
): Effect.Effect<unknown, InvalidSamplerConfig> =>
  Match.value(distribution).pipe(
    Match.when({ type: "categorical" }, ({ choices }) => sampleCategorical(rng, choices)),
    Match.when({ type: "int" }, ({ low, high, step }) => sampleInt(rng, low, high, Option.fromNullable(step))),
    Match.when({ type: "fidelity" }, ({ low, high }) => sampleInt(rng, low, high, Option.none())),
    Match.when({ type: "float" }, ({ low, high, scale, step }) =>
      sampleFloat(rng, low, high, Option.fromNullable(scale), Option.fromNullable(step))),
    Match.exhaustive
  )
