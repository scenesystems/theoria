import { Array as Arr, Data, Match, Number as Num, Option } from "effect"
import { sqrt } from "effect-math/Numeric"

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

const average = (values: ReadonlyArray<number>): number =>
  Match.value(values.length <= 0).pipe(
    Match.when(true, () => 0),
    Match.orElse(() =>
      Num.unsafeDivide(
        Arr.reduce(values, 0, (total, value) => Num.sum(total, value)),
        values.length
      )
    )
  )

const varianceFromMean = (
  values: ReadonlyArray<number>,
  mean: number
): number =>
  Match.value(values.length <= 1).pipe(
    Match.when(true, () => 0),
    Match.orElse(() =>
      Num.unsafeDivide(
        Arr.reduce(values, 0, (total, value) => {
          const centered = value - mean
          return Num.sum(total, centered * centered)
        }),
        values.length
      )
    )
  )

const variance = (values: ReadonlyArray<number>): number => varianceFromMean(values, average(values))

const minimumSpan = (low: number, high: number): number => Num.max(high - low, NOISE_FLOOR)

const bandwidthFromSample = (
  values: ReadonlyArray<number>,
  span: number
): number =>
  Match.value(values.length <= 1).pipe(
    Match.when(true, () => span),
    Match.orElse(() => {
      const stddev = sqrt(variance(values))
      const scottFactor = Math.pow(values.length, -0.2)
      return Num.max(stddev * scottFactor, NOISE_FLOOR)
    })
  )

const bootstrapIndex = (
  observationCount: number,
  replicateIndex: number,
  sampleIndex: number
): number =>
  Match.value(observationCount <= 0).pipe(
    Match.when(true, () => 0),
    Match.orElse(
      () => ((replicateIndex + 1) * 17 + (sampleIndex + 1) * 31) % observationCount
    )
  )

const bootstrapSample = (
  observations: ReadonlyArray<number>,
  replicateIndex: number
): ReadonlyArray<number> =>
  Arr.makeBy(observations.length, (sampleIndex) =>
    Option.fromNullable(
      observations[
        bootstrapIndex(observations.length, replicateIndex, sampleIndex)
      ]
    ).pipe(Option.getOrElse(() => 0)))

const bootstrapBandwidthVariance = (
  observations: ReadonlyArray<number>,
  span: number
): number =>
  Match.value(observations.length <= 1).pipe(
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

const finiteNonNegative = (value: number): boolean => Number.isFinite(value) && Num.greaterThanOrEqualTo(value, 0)

const observationVarianceFromSources = (
  observations: ReadonlyArray<number>,
  empiricalObservationVariance: Option.Option<number>
): number =>
  empiricalObservationVariance.pipe(
    Option.filter(finiteNonNegative),
    Option.getOrElse(() => variance(observations))
  )

export const estimateNoise = (
  observations: ReadonlyArray<number>,
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
      span * span
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
        1 + Num.max(options.noiseAlpha, 0) * estimate.normalizedNoise,
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
): number => bandwidth * bandwidthScaleFromNoiseEstimate(estimate, options)
