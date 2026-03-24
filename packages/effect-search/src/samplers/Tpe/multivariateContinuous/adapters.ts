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

/** @since 0.1.0 */
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

/** @since 0.1.0 */
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

/** @since 0.1.0 */
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

/** @since 0.1.0 */
export const configFromCandidate = (
  adapters: ReadonlyArray<ContinuousAdapter>,
  candidateValues: ReadonlyArray<number>
): unknown =>
  Record.fromEntries(Arr.map(Arr.zip(adapters, candidateValues), ([adapter, value]) => Tuple.make(adapter.name, value)))

/** @since 0.1.0 */
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
