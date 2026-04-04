import { Effect, Schema } from "effect"
import { Sampler, Study } from "effect-search"
import * as Arr from "effect/Array"

import { Experimental } from "../src/index.js"
import { scoreCalibrationReportSync } from "../src/experimental/Calibration/internal/scoring.js"
import { EffectTextSupportManifest } from "../src/contracts/supportManifest.js"
import {
  calibrationServices,
  canonicalCalibrationCases,
  defaultCalibrationProfile,
  exploratorySearchDescriptor
} from "../examples/live/calibrationFixtures.js"

const verificationIterations = EffectTextSupportManifest.benchmarks.calibrationScoring.iterations
const maxSlowdownRatio = EffectTextSupportManifest.benchmarks.calibrationScoring.maxSlowdownRatio

const PositiveInt = Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))
const PositiveNumber = Schema.Number.pipe(Schema.greaterThan(0))

const CalibrationScoringExpectation = Schema.Struct({
  profile: Experimental.Calibration.CalibrationProfile,
  manualTotal: Schema.Number,
  effectMathTotal: Schema.Number,
  manualSummary: Experimental.Calibration.CalibrationLossSummary,
  effectMathSummary: Experimental.Calibration.CalibrationLossSummary
})

const CalibrationVerificationArtifact = Schema.Struct({
  corpusCaseNames: Schema.Array(Schema.String),
  scoringBenchmark: Schema.Struct({
    iterations: PositiveInt,
    maxSlowdownRatio: PositiveNumber,
    expectations: Schema.Array(CalibrationScoringExpectation)
  }),
  optimization: Schema.Struct({
    bestProfile: Experimental.Calibration.CalibrationProfile,
    bestReport: Experimental.Calibration.CalibrationReport,
    optimization: Experimental.Calibration.CalibrationOptimizationReport
  })
})

export const CalibrationVerificationArtifactJson = Schema.parseJson(CalibrationVerificationArtifact)

const benchmarkProfiles: ReadonlyArray<Experimental.Calibration.CalibrationProfileType> = Arr.make(
  defaultCalibrationProfile,
  {
    name: "narrow-tabs",
    engineProfile: {
      ...defaultCalibrationProfile.engineProfile,
      tabWidth: 2
    }
  },
  {
    name: "rtl-soft-hyphen",
    engineProfile: {
      ...defaultCalibrationProfile.engineProfile,
      defaultDirection: "rtl",
      preferEarlySoftHyphenBreak: true
    }
  }
)

const zeroSummary = (): Experimental.Calibration.CalibrationLossSummaryType => ({
  count: 0,
  mean: 0,
  minimum: 0,
  maximum: 0,
  variance: 0,
  standardDeviation: 0
})

const singleValueSummary = (value: number): Experimental.Calibration.CalibrationLossSummaryType => ({
  count: 1,
  mean: value,
  minimum: value,
  maximum: value,
  variance: 0,
  standardDeviation: 0
})

const manualCaseLoss = (
  result: Experimental.Calibration.CalibrationCaseResultType,
  objective: Experimental.Calibration.CalibrationObjectiveMetadataType
): number =>
  (result.lineMismatchCount * objective.scoreWeights.lineMismatchCount) +
  (Math.abs(result.lineCountDelta) * objective.scoreWeights.lineCountError) +
  (Math.abs(result.maxLineWidthDelta) * objective.scoreWeights.maxLineWidthError)

const manualSummary = (values: ReadonlyArray<number>): Experimental.Calibration.CalibrationLossSummaryType => {
  if (values.length <= 0) {
    return zeroSummary()
  }

  if (values.length === 1) {
    return singleValueSummary(values[0] ?? 0)
  }

  const count = values.length
  const total = values.reduce((sum, value) => sum + value, 0)
  const mean = total / count
  const minimum = values.reduce((current, value) => Math.min(current, value), values[0] ?? 0)
  const maximum = values.reduce((current, value) => Math.max(current, value), values[0] ?? 0)
  const squaredDistanceTotal = values.reduce((sum, value) => {
    const distance = value - mean
    return sum + (distance * distance)
  }, 0)
  const variance = squaredDistanceTotal / (count - 1)

  return {
    count,
    mean,
    minimum,
    maximum,
    variance,
    standardDeviation: Math.sqrt(variance)
  }
}

const manualScoreReport = (
  report: Experimental.Calibration.CalibrationReportType,
  objective: Experimental.Calibration.CalibrationObjectiveMetadataType
) => {
  const caseLosses = report.results.map((result) => manualCaseLoss(result, objective))

  return {
    caseLosses,
    summary: manualSummary(caseLosses),
    total: caseLosses.reduce((sum, value) => sum + value, 0)
  }
}

const measureDuration = (iterations: number, run: () => Effect.Effect<void, unknown>) =>
  Effect.gen(function*() {
    const startedAt = yield* Effect.sync(() => performance.now())
    yield* Effect.forEach(Arr.range(1, iterations), () => run(), { discard: true })
    const finishedAt = yield* Effect.sync(() => performance.now())
    const totalDurationMs = finishedAt - startedAt

    return {
      meanDurationMs: totalDurationMs / iterations,
      totalDurationMs
    }
  })

const normalizeTrial = (trial: Study.SnapshotTrial): Study.SnapshotTrial => ({
  ...trial,
  state: "duration" in trial.state
    ? {
        ...trial.state,
        duration: 0
      }
    : trial.state
})

const normalizeSnapshot = (snapshot: Study.StudySnapshot): Study.StudySnapshot =>
  new Study.StudySnapshot({
    ...snapshot,
    trials: snapshot.trials.map(normalizeTrial),
    studyDuration: 0
  })

export const computeVerificationArtifact = Effect.gen(function*() {
  const objective = Experimental.Calibration.DefaultCalibrationObjective
  const reports = yield* Effect.forEach(benchmarkProfiles, (profile) =>
    Experimental.Calibration.evaluateProfile(profile, canonicalCalibrationCases).pipe(
      Effect.provide(calibrationServices),
      Effect.map((report) => ({ profile, report }))
    ))
  const expectations = yield* Effect.forEach(reports, ({ profile, report }) =>
    Effect.sync(() => {
      const effectMathScore = scoreCalibrationReportSync(report, objective)
      const manualScore = manualScoreReport(report, objective)

      return {
        effectMathSummary: effectMathScore.summary,
        effectMathTotal: effectMathScore.total,
        manualSummary: manualScore.summary,
        manualTotal: manualScore.total,
        profile
      }
    }))
  const optimized = yield* Experimental.Calibration.optimizeProfile({
    cases: canonicalCalibrationCases,
    services: calibrationServices,
    trials: 4,
    sampler: Sampler.random({ seed: 91 }),
    searchDescriptor: exploratorySearchDescriptor
  })

  return {
    corpusCaseNames: canonicalCalibrationCases.map((calibrationCase) => calibrationCase.name),
    scoringBenchmark: {
      expectations,
      iterations: verificationIterations,
      maxSlowdownRatio
    },
    optimization: {
      bestProfile: optimized.bestProfile,
      bestReport: optimized.bestReport,
      optimization: {
        ...optimized.optimization,
        artifacts: {
          ...optimized.optimization.artifacts,
          snapshot: normalizeSnapshot(optimized.optimization.artifacts.snapshot)
        }
      }
    }
  }
})

export const verifyBenchmarkGate = (
  expectations: ReadonlyArray<Schema.Schema.Type<typeof CalibrationScoringExpectation>>,
  allowedSlowdownRatio: number
) =>
  Effect.gen(function*() {
    const objective = Experimental.Calibration.DefaultCalibrationObjective
    const reports = yield* Effect.forEach(expectations, ({ profile }) =>
      Experimental.Calibration.evaluateProfile(profile, canonicalCalibrationCases).pipe(
        Effect.provide(calibrationServices),
        Effect.map((report) => report)
      ))
    const effectMathTiming = yield* measureDuration(verificationIterations, () =>
      Effect.sync(() => {
        reports.forEach((report) => {
          scoreCalibrationReportSync(report, objective)
        })
      }))
    const manualTiming = yield* measureDuration(verificationIterations, () =>
      Effect.forEach(reports, (report) => Effect.sync(() => manualScoreReport(report, objective)).pipe(Effect.asVoid), {
        discard: true
      }))
    const slowdownRatio = manualTiming.meanDurationMs <= 0
      ? effectMathTiming.meanDurationMs
      : effectMathTiming.meanDurationMs / manualTiming.meanDurationMs

    yield* Effect.log("effect-text calibration benchmark", {
      allowedSlowdownRatio,
      effectMathMeanDurationMs: effectMathTiming.meanDurationMs,
      manualMeanDurationMs: manualTiming.meanDurationMs,
      slowdownRatio
    })
    yield* Effect.when(
      Effect.dieMessage(
        `effect-text calibration scorer exceeded slowdown gate: ${slowdownRatio} > ${allowedSlowdownRatio}`
      ),
      () => slowdownRatio > allowedSlowdownRatio
    )
  })
