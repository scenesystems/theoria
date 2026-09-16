import { Array as Arr, Boolean, Match, Number as Num, Option, Schema } from "effect"

import * as Float64 from "../float64.js"
import type { ContinuousValues } from "./continuousParzen/model.js"

const NOISE_FLOOR = 1e-12
const BOOTSTRAP_REPLICATES = 8
const MAX_BANDWIDTH_SCALE = 5

export class NoiseEstimate extends Schema.Class<NoiseEstimate>("effect-search/NoiseEstimate")({
  observationVariance: Schema.Number,
  bootstrapBandwidthVariance: Schema.Number,
  normalizedNoise: Schema.Number
}) {}

export class NoiseBandwidthOptions extends Schema.Class<NoiseBandwidthOptions>("effect-search/NoiseBandwidthOptions")({
  noiseAware: Schema.Boolean,
  noiseAlpha: Schema.Number
}) {}

export const defaultNoiseBandwidthOptions = new NoiseBandwidthOptions({
  noiseAware: false,
  noiseAlpha: 1
})

const average = (values: ContinuousValues): number =>
  Match.value(Arr.isEmptyReadonlyArray(values)).pipe(
    Match.when(true, () => 0),
    Match.orElse(() =>
      Num.unsafeDivide(
        Arr.reduce(values, 0, (total, value) => Num.sum(total, value)),
        Arr.length(values)
      )
    )
  )

const varianceFromMean = (
  values: ContinuousValues,
  mean: number
): number =>
  Match.value(Num.lessThanOrEqualTo(Arr.length(values), 1)).pipe(
    Match.when(true, () => 0),
    Match.orElse(() =>
      Num.unsafeDivide(
        Arr.reduce(values, 0, (total, value) => {
          const centered = Num.subtract(value, mean)
          return Num.sum(total, Num.multiply(centered, centered))
        }),
        Arr.length(values)
      )
    )
  )

const variance = (values: ContinuousValues): number => varianceFromMean(values, average(values))

const minimumSpan = (low: number, high: number): number => Num.max(Num.subtract(high, low), NOISE_FLOOR)

const bandwidthFromSample = (
  values: ContinuousValues,
  span: number
): number =>
  Match.value(Num.lessThanOrEqualTo(Arr.length(values), 1)).pipe(
    Match.when(true, () => span),
    Match.orElse(() => {
      const stddev = Float64.sqrt(variance(values))
      const scottFactor = Math.pow(Arr.length(values), -0.2)
      return Num.max(Num.multiply(stddev, scottFactor), NOISE_FLOOR)
    })
  )

const bootstrapIndex = (
  observationCount: number,
  replicateIndex: number,
  sampleIndex: number
): number =>
  Match.value(Num.lessThanOrEqualTo(observationCount, 0)).pipe(
    Match.when(true, () => 0),
    Match.orElse(
      () =>
        Num.remainder(
          Num.sum(
            Num.multiply(Num.increment(replicateIndex), 17),
            Num.multiply(Num.increment(sampleIndex), 31)
          ),
          observationCount
        )
    )
  )

const bootstrapSample = (
  observations: ContinuousValues,
  replicateIndex: number
): ContinuousValues =>
  Arr.makeBy(Arr.length(observations), (sampleIndex) =>
    Arr.get(
      observations,
      bootstrapIndex(Arr.length(observations), replicateIndex, sampleIndex)
    ).pipe(Option.getOrElse(() => 0)))

const bootstrapBandwidthVariance = (
  observations: ContinuousValues,
  span: number
): number =>
  Match.value(Num.lessThanOrEqualTo(Arr.length(observations), 1)).pipe(
    Match.when(true, () => 0),
    Match.orElse(() =>
      variance(
        Arr.makeBy(
          BOOTSTRAP_REPLICATES,
          (replicateIndex) => bandwidthFromSample(bootstrapSample(observations, replicateIndex), span)
        )
      )
    )
  )

const isFinite = Schema.is(Schema.Finite)
const isNonNaN = Schema.is(Schema.NonNaN)

const finiteNonNegative = (value: number): boolean =>
  Boolean.and(
    isFinite(value),
    Boolean.and(isNonNaN(value), Num.greaterThanOrEqualTo(value, 0))
  )

const observationVarianceFromSources = (
  observations: ContinuousValues,
  empiricalObservationVariance: Option.Option<number>
): number =>
  empiricalObservationVariance.pipe(
    Option.filter(finiteNonNegative),
    Option.getOrElse(() => variance(observations))
  )

export const estimateNoise = (
  observations: ContinuousValues,
  low: number,
  high: number,
  empiricalObservationVariance: Option.Option<number> = Option.none()
): NoiseEstimate => {
  const span = minimumSpan(low, high)
  const observationVariance = observationVarianceFromSources(observations, empiricalObservationVariance)
  const bootstrapVariance = bootstrapBandwidthVariance(observations, span)
  const normalizedNoise = Num.max(
    Num.unsafeDivide(
      Num.sum(observationVariance, bootstrapVariance),
      Num.multiply(span, span)
    ),
    0
  )

  return new NoiseEstimate({
    observationVariance,
    bootstrapBandwidthVariance: bootstrapVariance,
    normalizedNoise
  })
}

export const bandwidthScaleFromNoiseEstimate = (
  estimate: NoiseEstimate,
  options: NoiseBandwidthOptions = defaultNoiseBandwidthOptions
): number =>
  Match.value(options.noiseAware).pipe(
    Match.when(false, () => 1),
    Match.orElse(() =>
      Num.clamp(
        Num.sum(1, Num.multiply(Num.max(options.noiseAlpha, 0), estimate.normalizedNoise)),
        {
          minimum: 1,
          maximum: MAX_BANDWIDTH_SCALE
        }
      )
    )
  )

export const adjustBandwidthForNoise = (
  bandwidth: number,
  estimate: NoiseEstimate,
  options: NoiseBandwidthOptions = defaultNoiseBandwidthOptions
): number => Num.multiply(bandwidth, bandwidthScaleFromNoiseEstimate(estimate, options))
