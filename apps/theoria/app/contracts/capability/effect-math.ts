/**
 * Power-demo projections backed by released effect-math report surfaces.
 *
 * The app freezes control plans and chart-ready projections, but the numerical
 * authority now lives in `effect-math/Statistics`, `effect-math/Optimization`,
 * and `effect-math/Distribution` rather than in app-local formulas.
 *
 * @since 0.1.0
 * @module
 */
import { Chunk, Schema } from "effect"
import * as Arr from "effect/Array"

import { normalCdf, normalPdf } from "effect-math/Distribution"
import {
  confidenceIntervalMean,
  MeanConfidenceIntervalReport,
  oneSampleTTest,
  PowerAnalysisReport,
  powerForMeanDifference,
  sampleSizeForTargetPower,
  SampleSizeForTargetPowerReport,
  TTestReport,
  twoSampleTTest
} from "effect-math/Statistics"

const PositiveInt = Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))

export const defaultPowerControls: {
  readonly d: 0.5
  readonly n: 30
  readonly alpha: 0.05
} = {
  d: 0.5,
  n: 30,
  alpha: 0.05
}
export const powerEffectSizeMin = 0.1
export const powerEffectSizeMax = 2.0
export const powerEffectSizeStep = 0.05
export const powerSampleSizeMin = 5
export const powerSampleSizeMax = 200
export const powerSampleSizeStep = 1
export const powerAlphaMin = 0.01
export const powerAlphaMax = 0.1
export const powerAlphaStep = 0.01

export const powerEffectSizeSweepValues: ReadonlyArray<number> = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0, 1.2, 1.5, 2.0]
export const powerSampleSizeSweepValues: ReadonlyArray<number> = [5, 10, 15, 20, 30, 40, 50, 60, 80, 100, 120, 150, 200]
export const powerAlphaSweepValues: ReadonlyArray<number> = [0.01, 0.05, 0.10]

export const PowerControls = Schema.Struct({
  d: Schema.Number,
  n: PositiveInt,
  alpha: Schema.Number
})

export type PowerControls = typeof PowerControls.Type

export const PowerProjection = Schema.Struct({
  d: Schema.Number,
  n: PositiveInt,
  alpha: Schema.Number,
  power: Schema.Number,
  requiredN: Schema.Number,
  overlap: Schema.Number,
  nonCentrality: Schema.Number,
  powerReport: PowerAnalysisReport,
  sampleSizeReport: SampleSizeForTargetPowerReport,
  confidenceIntervalReport: MeanConfidenceIntervalReport,
  oneSampleReport: TTestReport,
  twoSampleReport: TTestReport
})

export type PowerProjection = typeof PowerProjection.Type

export const EffectMathProjectionPhase = Schema.Struct({
  title: Schema.String,
  label: Schema.String,
  steps: Schema.Array(PowerControls)
})

export type EffectMathProjectionPhase = typeof EffectMathProjectionPhase.Type

export const EffectMathProjectionScript = Schema.Struct({
  _tag: Schema.Literal("effect-math"),
  baseControls: PowerControls,
  phases: Schema.Array(EffectMathProjectionPhase)
})

export type EffectMathProjectionScript = typeof EffectMathProjectionScript.Type

export const isEffectMathProjectionScript = Schema.is(EffectMathProjectionScript)

const fixedSampleSizeLabel = (n: number): string => `Power by effect size (fixed N=${n})`
const fixedSampleSizeTitle = ({ alpha, n }: PowerControls): string =>
  `Effect size sweep — N=${n}, α=${alpha.toFixed(2)}`
const fixedEffectSizeLabel = (d: number): string => `Power by sample size (fixed d=${d.toFixed(2)})`
const fixedEffectSizeTitle = ({ alpha, d }: PowerControls): string =>
  `Sample size sweep — d=${d.toFixed(2)}, α=${alpha.toFixed(2)}`

export const snapshotEffectMathProjectionScript = (baseControls: PowerControls): EffectMathProjectionScript => ({
  _tag: "effect-math",
  baseControls,
  phases: [
    {
      title: fixedSampleSizeTitle(baseControls),
      label: fixedSampleSizeLabel(baseControls.n),
      steps: Arr.map(
        powerEffectSizeSweepValues,
        (d): PowerControls => ({ d, n: baseControls.n, alpha: baseControls.alpha })
      )
    },
    {
      title: fixedEffectSizeTitle(baseControls),
      label: fixedEffectSizeLabel(baseControls.d),
      steps: Arr.map(
        powerSampleSizeSweepValues,
        (n): PowerControls => ({ d: baseControls.d, n, alpha: baseControls.alpha })
      )
    },
    {
      title: "Required N at 80% power — across α levels",
      label: "Required N by effect size and α",
      steps: Arr.flatMap(powerAlphaSweepValues, (alpha) =>
        Arr.map(powerEffectSizeSweepValues, (d): PowerControls => {
          const requiredSampleSize = requiredN(d, 0.80, alpha)

          return {
            d,
            n: Number.isFinite(requiredSampleSize) ? requiredSampleSize : 200,
            alpha
          }
        }))
    }
  ]
})

export class EffectMathCanonicalStep extends Schema.TaggedClass<EffectMathCanonicalStep>()("EffectMathCanonicalStep", {
  controls: PowerControls,
  projection: PowerProjection
}) {}

const targetPower = 0.8
const representativeOffsets: ReadonlyArray<number> = [-1.2, -0.85, -0.4, -0.1, 0.15, 0.45, 0.9, 1.25]

const repeatedOffset = (index: number): number => {
  const cycle = representativeOffsets[index % representativeOffsets.length] ?? 0
  const block = Math.floor(index / representativeOffsets.length)

  return cycle + block * 0.035
}

const representativeSample = ({
  meanShift,
  sampleSize
}: {
  readonly meanShift: number
  readonly sampleSize: number
}): Chunk.Chunk<number> =>
  Chunk.fromIterable(
    Arr.map(Arr.range(0, sampleSize - 1), (index) => meanShift + repeatedOffset(index))
  )

const powerReportFor = ({ alpha, d, n }: PowerControls) =>
  powerForMeanDifference(d, n, {
    alpha,
    alternative: "twoSided"
  })

const sampleSizeReportFor = (
  {
    alpha,
    d
  }: {
    readonly alpha: PowerControls["alpha"]
    readonly d: PowerControls["d"]
  },
  desiredPower: number
) =>
  sampleSizeForTargetPower(d, desiredPower, {
    alpha,
    alternative: "twoSided",
    maxSampleSize: 10_000
  })

const inferenceReportsFor = ({ alpha, d, n }: PowerControls) => {
  const controlSample = representativeSample({ meanShift: 0, sampleSize: n })
  const treatmentSample = representativeSample({ meanShift: d, sampleSize: n })

  return {
    confidenceIntervalReport: confidenceIntervalMean(treatmentSample, {
      confidenceLevel: 1 - alpha,
      alternative: "twoSided"
    }),
    oneSampleReport: oneSampleTTest(treatmentSample, {
      alpha,
      alternative: "twoSided",
      nullValue: 0
    }),
    twoSampleReport: twoSampleTTest(treatmentSample, controlSample, {
      alpha,
      alternative: "twoSided",
      nullValue: 0
    })
  }
}

// ---------------------------------------------------------------------------
// Core power analysis kernels
// ---------------------------------------------------------------------------

/**
 * Standard error for an equal-group two-sample comparison: SE = √(2/n).
 *
 * @since 0.1.0
 * @category power analysis
 */
export const standardError = (n: number): number => Math.sqrt(2 / n)

/**
 * Non-centrality parameter for a two-sample test: δ = d / SE(n) = d · √(n/2).
 *
 * @since 0.1.0
 * @category power analysis
 */
export const nonCentrality = (d: number, n: number): number => d * Math.sqrt(n / 2)

/**
 * Two-sided power using the normal approximation.
 *
 * criticalZ = Φ⁻¹(1 − α/2)
 * δ = d · √(n/2)
 * power = 1 − Φ(criticalZ − δ) + Φ(−criticalZ − δ)
 *
 * @since 0.1.0
 * @category power analysis
 */
export const power = (d: number, n: number, alpha: number): number => {
  const report = powerForMeanDifference(d, n, {
    alpha,
    alternative: "twoSided"
  })

  return report.power
}

export const projectPowerProjection = ({ d, n, alpha }: PowerControls): PowerProjection => {
  const powerReport = powerReportFor({ d, n, alpha })
  const sampleSizeReport = sampleSizeReportFor({ d, alpha }, targetPower)
  const reports = inferenceReportsFor({ d, n, alpha })

  return {
    d,
    n,
    alpha,
    power: powerReport.power,
    requiredN: sampleSizeReport.solver.status === "converged" ? sampleSizeReport.sampleSize : Infinity,
    overlap: overlapCoefficient(d),
    nonCentrality: powerReport.noncentrality,
    powerReport,
    sampleSizeReport,
    confidenceIntervalReport: reports.confidenceIntervalReport,
    oneSampleReport: reports.oneSampleReport,
    twoSampleReport: reports.twoSampleReport
  }
}

/**
 * Minimum per-group sample size achieving `targetPower` via the package-owned
 * bracketed root solver over N ∈ [2, 10000].
 *
 * Returns `Infinity` when the target is unreachable (e.g. d ≈ 0 or
 * targetPower ≤ alpha), since no finite sample size can deliver power
 * beyond the significance level for a zero effect.
 *
 * @since 0.1.0
 * @category power analysis
 */
export const requiredN = (d: number, targetPower: number, alpha: number): number => {
  const report = sampleSizeReportFor({ alpha, d }, targetPower)

  return report.solver.status === "converged" ? report.sampleSize : Infinity
}

// ---------------------------------------------------------------------------
// Distribution geometry
// ---------------------------------------------------------------------------

/**
 * Overlap coefficient (OVL) of two unit-variance normals separated by d:
 * OVL = 2 · Φ(−d/2).
 *
 * @since 0.1.0
 * @category distribution geometry
 */
export const overlapCoefficient = (d: number): number => 2 * normalCdf(-d / 2, 0, 1)

// ---------------------------------------------------------------------------
// Curve generation
// ---------------------------------------------------------------------------

/**
 * Generate evenly spaced points for rendering a normal PDF curve.
 *
 * @since 0.1.0
 * @category curve generation
 */
export const pdfCurvePoints = (
  mu: number,
  sigma: number,
  xMin: number,
  xMax: number,
  steps: number
): ReadonlyArray<{ readonly x: number; readonly y: number }> => {
  const step = (xMax - xMin) / steps
  return Arr.map(Arr.range(0, steps), (index) => {
    const x = xMin + index * step
    return { x, y: normalPdf(x, mu, sigma) }
  })
}

/**
 * Power at each sample size — produces a curve suitable for plotting
 * power as a function of N.
 *
 * @since 0.1.0
 * @category curve generation
 */
export const powerCurve = (
  d: number,
  alpha: number,
  nValues: ReadonlyArray<number>
): ReadonlyArray<{ readonly n: number; readonly power: number }> =>
  nValues.map((n) => ({ n, power: power(d, n, alpha) }))
