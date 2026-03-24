/**
 * Multivariate continuous adapters — maps numeric parameters to a model coordinate system and back.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Effect, Match, Number as Num, Option, Record, Tuple } from "effect"

import type { InvalidSamplerConfig } from "../../../Errors/index.js"
import { type SamplerConfig, valueFromConfig } from "../../../internal/configAccess.js"
import type * as SearchSpace from "../../../SearchSpace/index.js"
import { expandedBoundsForStep, normalizeFloat } from "../dimensions/float.js"
import { invalidConfig } from "../options.js"

/**
 * Maps a numeric search-space parameter to a model coordinate system
 * (e.g. log-space) and back, enabling the multivariate Gaussian kernel to
 * operate in a normalized domain.
 *
 * Each adapter encapsulates the forward transform (`toModel`) and the inverse
 * clamping/quantization step (`normalize`) for one continuous dimension.
 *
 * @see {@link adapterForParameter} for constructing an adapter from a parameter spec
 * @see {@link configFromCandidate} for mapping model-space candidates back to configs
 * @since 0.1.0
 * @category models
 */
export class ContinuousAdapter extends Data.Class<{
  readonly name: string
  readonly toModel: (value: number) => number
  readonly normalize: (modelValue: number) => number
}> {}

const finiteNumberFromUnknown = (value: unknown): Option.Option<number> =>
  Match.value(value).pipe(
    Match.when(Match.number, (numericValue) =>
      Match.value(Number.isFinite(numericValue)).pipe(
        Match.when(true, () => Option.some(numericValue)),
        Match.orElse(() => Option.none())
      )),
    Match.orElse(() => Option.none())
  )

const modelValueFromConfig = (adapter: ContinuousAdapter, config: SamplerConfig): Option.Option<number> =>
  valueFromConfig(config, adapter.name).pipe(
    Option.flatMap(finiteNumberFromUnknown),
    Option.map((value) => adapter.toModel(value))
  )

/**
 * Constructs a {@link ContinuousAdapter} for a given parameter, selecting the
 * appropriate model transform (identity, log, or integer-expanded) based on
 * distribution type and scale.
 *
 * Fails for categorical parameters since they have no continuous model-space
 * representation.
 *
 * @see {@link ContinuousAdapter} for the output shape
 * @see {@link vectorsFromSplit} for extracting model-space vectors using adapters
 * @since 0.1.0
 * @category constructors
 */
export const adapterForParameter = (
  parameter: SearchSpace.ParameterMetadata
): Effect.Effect<ContinuousAdapter, InvalidSamplerConfig> =>
  Match.value(parameter.distribution).pipe(
    Match.when({ type: "float" }, ({ low, high, scale, step }) => {
      const scaleOption = Option.fromNullable(scale)
      const stepOption = Option.fromNullable(step)

      return Option.match(scaleOption, {
        onNone: () =>
          Effect.succeed(
            new ContinuousAdapter({
              name: parameter.name,
              toModel: (value: number) => value,
              normalize: (modelValue: number) => normalizeFloat(modelValue, low, high, stepOption)
            })
          ),
        onSome: (resolvedScale) =>
          Match.value(resolvedScale).pipe(
            Match.when("log", () =>
              Match.value(Num.lessThanOrEqualTo(low, 0) || Num.lessThanOrEqualTo(high, 0)).pipe(
                Match.when(true, () =>
                  Effect.fail(
                    invalidConfig(
                      `tpe multivariate log-scaled float dimension "${parameter.name}" requires low > 0 and high > 0`
                    )
                  )),
                Match.orElse(() =>
                  Effect.succeed(
                    new ContinuousAdapter({
                      name: parameter.name,
                      toModel: (value: number) => Math.log(value),
                      normalize: (modelValue: number) => normalizeFloat(Math.exp(modelValue), low, high, stepOption)
                    })
                  )
                )
              )),
            Match.orElse(() =>
              Effect.succeed(
                new ContinuousAdapter({
                  name: parameter.name,
                  toModel: (value: number) => value,
                  normalize: (modelValue: number) => normalizeFloat(modelValue, low, high, stepOption)
                })
              )
            )
          )
      })
    }),
    Match.when({ type: "int" }, ({ low, high, step }) => {
      const stride = Option.orElse(Option.fromNullable(step), () => Option.some(1))
      const [expandedLow, expandedHigh] = expandedBoundsForStep(low, high, stride)

      return Effect.succeed(
        new ContinuousAdapter({
          name: parameter.name,
          toModel: (value: number) =>
            Num.clamp(value, {
              minimum: expandedLow,
              maximum: expandedHigh
            }),
          normalize: (modelValue: number) => Num.round(normalizeFloat(modelValue, low, high, stride), 0)
        })
      )
    }),
    Match.when({ type: "fidelity" }, ({ low, high }) => {
      const [expandedLow, expandedHigh] = expandedBoundsForStep(low, high, Option.some(1))

      return Effect.succeed(
        new ContinuousAdapter({
          name: parameter.name,
          toModel: (value: number) =>
            Num.clamp(value, {
              minimum: expandedLow,
              maximum: expandedHigh
            }),
          normalize: (modelValue: number) => Num.round(normalizeFloat(modelValue, low, high, Option.some(1)), 0)
        })
      )
    }),
    Match.when({ type: "categorical" }, () =>
      Effect.fail(
        invalidConfig(
          `tpe multivariate trace expected numeric parameter but received categorical "${parameter.name}"`
        )
      )),
    Match.exhaustive
  )

const modelVectorFromConfig = (
  adapters: ReadonlyArray<ContinuousAdapter>,
  config: SamplerConfig
): Option.Option<ReadonlyArray<number>> =>
  Arr.reduce(
    adapters,
    Option.some(Arr.empty<number>()),
    (accumulator, adapter) =>
      accumulator.pipe(
        Option.flatMap((currentValues) =>
          modelValueFromConfig(adapter, config).pipe(
            Option.map((value) => Arr.append(currentValues, value))
          )
        )
      )
  )

/**
 * Extracts model-space coordinate vectors from a trial split, discarding
 * trials with missing or non-finite parameter values.
 *
 * Produces the observation matrix that the multivariate Parzen estimator
 * fits its kernel density to.
 *
 * @see {@link adapterForParameter} for building the adapter array
 * @see {@link configFromCandidate} for the inverse operation
 * @since 0.1.0
 * @category constructors
 */
export const vectorsFromSplit = (
  adapters: ReadonlyArray<ContinuousAdapter>,
  trials: ReadonlyArray<{ readonly config: SamplerConfig }>
): ReadonlyArray<ReadonlyArray<number>> =>
  Arr.flatMap(trials, (trial) =>
    modelVectorFromConfig(adapters, trial.config).pipe(
      Option.match({
        onNone: () => Arr.empty<ReadonlyArray<number>>(),
        onSome: (vector) => [vector]
      })
    ))

/**
 * Converts a normalized candidate vector back into a name→value config
 * record using the adapter ordering.
 *
 * This is the inverse of {@link vectorsFromSplit} — it maps model-space
 * coordinates back to the parameter names the search space expects.
 *
 * @see {@link normalizeModelCandidate} for the pre-normalization step
 * @see {@link vectorsFromSplit} for the forward direction
 * @since 0.1.0
 * @category constructors
 */
export const configFromCandidate = (
  adapters: ReadonlyArray<ContinuousAdapter>,
  candidateValues: ReadonlyArray<number>
): unknown =>
  Record.fromEntries(Arr.map(Arr.zip(adapters, candidateValues), ([adapter, value]) => Tuple.make(adapter.name, value)))

/**
 * Clamps and rounds each coordinate of a model-space candidate through its
 * adapter's normalize function, failing if the vector length does not match
 * the adapter count.
 *
 * Ensures every sampled candidate lies within the valid parameter bounds
 * before it is converted back to a config record.
 *
 * @see {@link configFromCandidate} for the next step after normalization
 * @see {@link ContinuousAdapter} for the per-dimension normalize function
 * @since 0.1.0
 * @category guards
 */
export const normalizeModelCandidate = (
  adapters: ReadonlyArray<ContinuousAdapter>,
  modelCandidate: ReadonlyArray<number>,
  candidateIndex: number
): Effect.Effect<ReadonlyArray<number>, InvalidSamplerConfig> =>
  Match.value(modelCandidate.length === adapters.length).pipe(
    Match.when(false, () =>
      Effect.fail(
        invalidConfig(
          `tpe multivariate candidate ${candidateIndex} has ${modelCandidate.length} coordinates but ${adapters.length} dimensions were expected`
        )
      )),
    Match.orElse(() =>
      Effect.succeed(
        Arr.map(Arr.zip(adapters, modelCandidate), ([adapter, modelValue]) => adapter.normalize(modelValue))
      )
    )
  )
