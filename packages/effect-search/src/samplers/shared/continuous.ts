/**
 * Continuous search-space utilities shared by advanced samplers.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Effect, Match, Number as Num, Option, Predicate } from "effect"
import { exp, logStrict } from "effect-math/Numeric"

import type { Distribution } from "../../contracts/Distribution.js"
import { SamplerSearchSpaceUnsupported } from "../../Errors/index.js"
import type { SamplerConfig } from "../../internal/configAccess.js"
import { valueFromConfig } from "../../internal/configAccess.js"
import type * as SearchSpace from "../../SearchSpace/index.js"

const clamp01 = (value: number): number =>
  Num.clamp(value, {
    minimum: 0,
    maximum: 1
  })

/**
 * Canonical continuous-dimension descriptor used by vectorized samplers.
 *
 * @since 0.1.0
 * @category models
 */
export class ContinuousDimension extends Data.Class<{
  readonly name: string
  readonly distribution: Distribution
}> {}

const unsupported = (
  sampler: string,
  reason: string,
  dimension?: string,
  distribution?: string
): Effect.Effect<never, SamplerSearchSpaceUnsupported> =>
  Effect.fail(
    new SamplerSearchSpaceUnsupported({
      sampler,
      reason,
      ...Option.fromNullable(dimension).pipe(
        Option.match({
          onNone: () => ({}),
          onSome: (resolvedDimension) => ({ dimension: resolvedDimension })
        })
      ),
      ...Option.fromNullable(distribution).pipe(
        Option.match({
          onNone: () => ({}),
          onSome: (resolvedDistribution) => ({ distribution: resolvedDistribution })
        })
      )
    })
  )

const validateNumericBounds = (
  sampler: string,
  dimension: SearchSpace.ParameterMetadata,
  distribution: Distribution
): Effect.Effect<void, SamplerSearchSpaceUnsupported> =>
  Match.value(distribution).pipe(
    Match.when({ type: "float" }, ({ low, high, scale }) =>
      Effect.gen(function*() {
        yield* Effect.when(
          unsupported(sampler, "requires finite numeric bounds", dimension.name, distribution.type),
          () => !Number.isFinite(low) || !Number.isFinite(high)
        )
        yield* Effect.when(
          unsupported(sampler, "requires high > low for each dimension", dimension.name, distribution.type),
          () => Num.lessThanOrEqualTo(high, low)
        )
        yield* Effect.when(
          unsupported(sampler, "requires positive bounds for log-scaled dimensions", dimension.name, distribution.type),
          () => scale === "log" && (Num.lessThanOrEqualTo(low, 0) || Num.lessThanOrEqualTo(high, 0))
        )
      })),
    Match.when({ type: "int" }, ({ low, high }) =>
      Effect.gen(function*() {
        yield* Effect.when(
          unsupported(sampler, "requires finite numeric bounds", dimension.name, distribution.type),
          () => !Number.isFinite(low) || !Number.isFinite(high)
        )
        yield* Effect.when(
          unsupported(sampler, "requires high > low for each dimension", dimension.name, distribution.type),
          () => Num.lessThanOrEqualTo(high, low)
        )
      })),
    Match.orElse(() => Effect.void)
  )

/**
 * Selects and validates continuous-compatible dimensions from a search
 * space for samplers that operate in normalized vector coordinates.
 *
 * @since 0.1.0
 * @category operations
 */
export const continuousDimensionsFromSpace = (
  sampler: string,
  space: SearchSpace.SearchSpace
): Effect.Effect<Array<ContinuousDimension>, SamplerSearchSpaceUnsupported> =>
  Effect.reduce(
    space.params,
    Arr.empty<ContinuousDimension>(),
    (dimensions, parameter) =>
      Match.value(parameter.distribution).pipe(
        Match.when({ type: "float" }, (distribution) =>
          validateNumericBounds(sampler, parameter, distribution).pipe(
            Effect.as(Arr.append(dimensions, new ContinuousDimension({ name: parameter.name, distribution })))
          )),
        Match.when({ type: "int" }, (distribution) =>
          validateNumericBounds(sampler, parameter, distribution).pipe(
            Effect.as(Arr.append(dimensions, new ContinuousDimension({ name: parameter.name, distribution })))
          )),
        Match.orElse((distribution) =>
          unsupported(
            sampler,
            "currently supports only continuous and integer dimensions",
            parameter.name,
            distribution.type
          )
        )
      )
  ).pipe(
    Effect.flatMap((dimensions) =>
      Num.greaterThan(dimensions.length, 0)
        ? Effect.succeed(dimensions)
        : unsupported(sampler, "requires at least one continuous dimension")
    )
  )

const normalizeValueForDimension = (dimension: ContinuousDimension, value: number): number =>
  Match.value(dimension.distribution).pipe(
    Match.when({ type: "float" }, ({ low, high, scale }) => {
      const normalized = Match.value(scale).pipe(
        Match.when("log", () => (logStrict(value) - logStrict(low)) / (logStrict(high) - logStrict(low))),
        Match.orElse(() => (value - low) / (high - low))
      )

      return clamp01(normalized)
    }),
    Match.when({ type: "int" }, ({ low, high }) => clamp01((value - low) / (high - low))),
    Match.orElse(() => 0.5)
  )

const quantizeValue = (value: number, low: number, high: number, step: Option.Option<number>): number =>
  Option.match(step, {
    onNone: () => Num.clamp(value, { minimum: low, maximum: high }),
    onSome: (stride) => {
      const steps = Num.round((value - low) / stride, 0)
      const quantized = low + (steps * stride)

      return Num.clamp(quantized, { minimum: low, maximum: high })
    }
  })

const denormalizeValueForDimension = (dimension: ContinuousDimension, normalized: number): number =>
  Match.value(dimension.distribution).pipe(
    Match.when({ type: "float" }, ({ low, high, scale, step }) => {
      const clamped = clamp01(normalized)
      const raw = Match.value(scale).pipe(
        Match.when("log", () => {
          const logLow = logStrict(low)
          const logHigh = logStrict(high)
          return exp(logLow + (clamped * (logHigh - logLow)))
        }),
        Match.orElse(() => low + (clamped * (high - low)))
      )

      return quantizeValue(raw, low, high, Option.fromNullable(step))
    }),
    Match.when({ type: "int" }, ({ low, high, step }) => {
      const clamped = clamp01(normalized)
      const raw = low + (clamped * (high - low))
      const quantized = quantizeValue(raw, low, high, Option.fromNullable(step))

      return Num.round(quantized, 0)
    }),
    Match.orElse(() => 0)
  )

/**
 * Encodes a configuration into normalized `[0, 1]` coordinates for the
 * provided continuous dimensions.
 *
 * @since 0.1.0
 * @category operations
 */
export const normalizedVectorFromConfig = (
  dimensions: ReadonlyArray<ContinuousDimension>,
  config: SamplerConfig
): Option.Option<Array<number>> =>
  Arr.reduce(
    dimensions,
    Option.some(Arr.empty<number>()),
    (accumulator, dimension) =>
      Option.flatMap(accumulator, (accumulated) =>
        valueFromConfig(config, dimension.name).pipe(
          Option.filter(Predicate.isNumber),
          Option.filter(Number.isFinite),
          Option.map((value) => Arr.append(accumulated, normalizeValueForDimension(dimension, value)))
        ))
  )

/**
 * Decodes normalized vector coordinates back into a concrete sampler
 * configuration with distribution-aware scaling and quantization.
 *
 * @since 0.1.0
 * @category operations
 */
export const denormalizeVector = (
  dimensions: ReadonlyArray<ContinuousDimension>,
  vector: ReadonlyArray<number>
): SamplerConfig => {
  const initial: SamplerConfig = {}

  return Arr.reduce(dimensions, initial, (config, dimension, index) => {
    const normalized = Arr.get(vector, index).pipe(Option.getOrElse(() => 0.5))

    return {
      ...config,
      [dimension.name]: denormalizeValueForDimension(dimension, normalized)
    }
  })
}

/**
 * Returns the neutral center point (`0.5`) for each normalized dimension.
 *
 * @since 0.1.0
 * @category operations
 */
export const normalizedCenter = (dimensions: ReadonlyArray<ContinuousDimension>): Array<number> =>
  Arr.makeBy(dimensions.length, () => 0.5)
