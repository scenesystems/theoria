import { pow, sqrt } from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Boolean as Bool, Data, Match, Number as Num, Option } from "effect"

const NOISE_FLOOR = 1e-12
const BOOTSTRAP_REPLICATES = 8
const MAX_BANDWIDTH_SCALE = 5

export class NoiseEstimate extends Data.Class<{
  readonly observationVariance: number
  readonly bootstrapBandwidthVariance: number
  readonly normalizedNoise: number
}> {}

export class NoiseBandwidthOptions extends Data.Class<{
  readonly noiseAware: boolean
  readonly noiseAlpha: number
}> {}

export const defaultNoiseBandwidthOptions = new NoiseBandwidthOptions({
  noiseAware: false,
  noiseAlpha: 1
})

const average = (valuesInput: Iterable<number>): number => {
  const values = Arr.fromIterable(valuesInput)
  return Match.value(Num.lessThanOrEqualTo(values.length, 0)).pipe(
    Match.when(true, () => 0),
    Match.orElse(() =>
      Num.unsafeDivide(
        Arr.reduce(values, 0, (total, value) => Num.sum(total, value)),
        values.length
      )
    )
  )
}

const varianceFromMean = (
  valuesInput: Iterable<number>,
  mean: number
): number => {
  const values = Arr.fromIterable(valuesInput)
  return Match.value(Num.lessThanOrEqualTo(values.length, 1)).pipe(
    Match.when(true, () => 0),
    Match.orElse(() =>
      Num.unsafeDivide(
        Arr.reduce(values, 0, (total, value) => {
          const centered = Num.subtract(value, mean)
          return Num.sum(total, Num.multiply(centered, centered))
        }),
        values.length
      )
    )
  )
}

const variance = (valuesInput: Iterable<number>): number => {
  const values = Arr.fromIterable(valuesInput)
  return varianceFromMean(values, average(values))
}

const minimumSpan = (low: number, high: number): number => Num.max(Num.subtract(high, low), NOISE_FLOOR)

const bandwidthFromSample = (
  valuesInput: Iterable<number>,
  span: number
): number => {
  const values = Arr.fromIterable(valuesInput)
  return Match.value(Num.lessThanOrEqualTo(values.length, 1)).pipe(
    Match.when(true, () => span),
    Match.orElse(() => {
      const stddev = sqrt(variance(values))
      const scottFactor = pow(values.length, -0.2)
      return Num.max(Num.multiply(stddev, scottFactor), NOISE_FLOOR)
    })
  )
}

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
          Num.sum(Num.multiply(Num.increment(replicateIndex), 17), Num.multiply(Num.increment(sampleIndex), 31)),
          observationCount
        )
    )
  )

const bootstrapSample = (
  observationsInput: Iterable<number>,
  replicateIndex: number
) => {
  const observations = Arr.fromIterable(observationsInput)
  return Arr.makeBy(
    observations.length,
    (sampleIndex) =>
      Arr.get(observations, bootstrapIndex(observations.length, replicateIndex, sampleIndex)).pipe(
        Option.getOrElse(() => 0)
      )
  )
}

const bootstrapBandwidthVariance = (
  observationsInput: Iterable<number>,
  span: number
): number => {
  const observations = Arr.fromIterable(observationsInput)
  return Match.value(Num.lessThanOrEqualTo(observations.length, 1)).pipe(
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
}

const finiteNonNegative = (value: number): boolean =>
  Bool.and(Number.isFinite(value), Num.greaterThanOrEqualTo(value, 0))

const observationVarianceFromSources = (
  observationsInput: Iterable<number>,
  empiricalObservationVariance: Option.Option<number>
): number => {
  const observations = Arr.fromIterable(observationsInput)
  return empiricalObservationVariance.pipe(
    Option.filter(finiteNonNegative),
    Option.getOrElse(() => variance(observations))
  )
}

export const estimateNoise = (
  observationsInput: Iterable<number>,
  low: number,
  high: number,
  empiricalObservationVariance: Option.Option<number> = Option.none()
): NoiseEstimate => {
  const observations = Arr.fromIterable(observationsInput)

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
