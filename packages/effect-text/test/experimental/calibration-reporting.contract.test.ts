import { FileSystem } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Option, Schema } from "effect"
import { Contracts as SearchContracts, Sampler, Study } from "effect-search"

import { Experimental } from "../../src/index.js"
import {
  calibrationServices,
  canonicalCalibrationCases,
  defaultSearchDescriptor,
  exploratorySearchDescriptor
} from "./fixtures.js"

const manualScore = (
  report: Experimental.Calibration.CalibrationReportType,
  objective: Experimental.Calibration.CalibrationObjectiveMetadataType
): number =>
  report.results.reduce(
    (total, result) =>
      total +
      (result.lineMismatchCount * objective.scoreWeights.lineMismatchCount) +
      (Math.abs(result.lineCountDelta) * objective.scoreWeights.lineCountError) +
      (Math.abs(result.maxLineWidthDelta) * objective.scoreWeights.maxLineWidthError),
    0
  )

const makeEnvelopeContextLayer = (options: {
  readonly runIdText: string
  readonly studyId: string
}) =>
  Effect.gen(function*() {
    const packageVersion = yield* Schema.decode(SearchContracts.PackageVersion)("0.2.0")
    const runId = yield* Schema.decode(SearchContracts.RunId)(options.runIdText)

    return SearchContracts.EnvelopeContextLive({
      packageVersion,
      runId,
      studyId: options.studyId
    })
  }).pipe(Layer.unwrapEffect)

const makeStudyStorage = (options: {
  readonly directory: string
  readonly runIdText: string
  readonly studyId: string
}) =>
  Study.makeStudyStorage(Study.studyStorageOptions(options.directory)).pipe(
    Effect.provide(SearchContracts.fileSystemSink(options.directory)),
    Effect.provide(makeEnvelopeContextLayer(options))
  )

describe("Experimental.Calibration reporting contracts", () => {
  it.effect("optimizeProfile emits a StudySnapshot and ordered StudyEvent log", () =>
    Effect.gen(function*() {
      const optimized = yield* Experimental.Calibration.optimizeProfile({
        cases: canonicalCalibrationCases,
        services: calibrationServices,
        trials: 2,
        sampler: Sampler.grid(),
        searchDescriptor: defaultSearchDescriptor
      })

      expect(Schema.is(Experimental.Calibration.CalibrationStudyArtifacts)(optimized.optimization.artifacts)).toBe(true)
      expect(optimized.optimization.artifacts.eventLog[0]?._tag).toBe("TrialStarted")
      expect(optimized.optimization.artifacts.eventLog.at(-1)?._tag).toBe("StudyCompleted")
      expect(optimized.optimization.artifacts.snapshot.completedCount).toBe(2)
    }))

  it.effect("optimization studies resume from a snapshot without changing the winning profile", () =>
    Effect.gen(function*() {
      const baseline = yield* Experimental.Calibration.optimizeProfile({
        cases: canonicalCalibrationCases,
        services: calibrationServices,
        trials: 4,
        sampler: Sampler.random({ seed: 91 }),
        searchDescriptor: exploratorySearchDescriptor
      })
      const firstLeg = yield* Experimental.Calibration.optimizeProfile({
        cases: canonicalCalibrationCases,
        services: calibrationServices,
        trials: 2,
        sampler: Sampler.random({ seed: 91 }),
        searchDescriptor: exploratorySearchDescriptor
      })
      const resumed = yield* Experimental.Calibration.optimizeProfile({
        cases: canonicalCalibrationCases,
        services: calibrationServices,
        trials: 2,
        sampler: Sampler.random({ seed: 91 }),
        searchDescriptor: exploratorySearchDescriptor,
        snapshot: firstLeg.optimization.artifacts.snapshot
      })

      expect(resumed.bestProfile).toEqual(baseline.bestProfile)
      expect(resumed.optimization.bestScore).toBe(baseline.optimization.bestScore)
      expect(resumed.optimization.artifacts.eventLog[0]?._tag).toBe("TrialStarted")
      expect(resumed.optimization.artifacts.eventLog.at(-1)?._tag).toBe("StudyCompleted")
      expect(resumed.optimization.artifacts.snapshot.completedCount).toBe(4)
    }))

  it.scoped("optimization studies can persist and resume through effect-search StudyStorage", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const directory = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "effect-text-calibration-study-"
      })
      const firstLegStorage = yield* makeStudyStorage({
        directory,
        runIdText: "01HZ0000000000000000000000",
        studyId: "effect-text-calibration-first-leg"
      })
      const firstLeg = yield* Experimental.Calibration.optimizeProfile({
        cases: canonicalCalibrationCases,
        services: calibrationServices,
        trials: 2,
        sampler: Sampler.random({ seed: 91 }),
        searchDescriptor: exploratorySearchDescriptor,
        studyStorage: firstLegStorage
      })
      const resumedStorage = yield* makeStudyStorage({
        directory,
        runIdText: "01HZ0000000000000000000001",
        studyId: "effect-text-calibration-resume-leg"
      })
      const resumed = yield* Experimental.Calibration.optimizeProfile({
        cases: canonicalCalibrationCases,
        services: calibrationServices,
        trials: 2,
        sampler: Sampler.random({ seed: 91 }),
        searchDescriptor: exploratorySearchDescriptor,
        snapshot: firstLeg.optimization.artifacts.snapshot,
        studyStorage: resumedStorage
      })
      const persistedSnapshot = yield* resumedStorage.loadSnapshot()
      const persistedTrials = yield* resumedStorage.loadTrialLog()

      expect(Option.isSome(persistedSnapshot)).toBe(true)
      expect(persistedTrials).toHaveLength(4)
      expect(resumed.optimization.artifacts.snapshot.completedCount).toBe(4)
      expect(resumed.optimization.artifacts.eventLog[0]?._tag).toBe("TrialStarted")
      expect(resumed.optimization.artifacts.eventLog.at(-1)?._tag).toBe("StudyCompleted")

      if (Option.isSome(persistedSnapshot)) {
        expect(persistedSnapshot.value.completedCount).toBe(4)
        expect(persistedSnapshot.value.nextTrialNumber).toBe(4)
      }
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("score weights and objective metadata are explicit inputs rather than hidden constants", () =>
    Effect.gen(function*() {
      const objective: Experimental.Calibration.CalibrationObjectiveMetadataType = {
        name: "line-width-first",
        direction: "minimize",
        scorer: "weighted-sum",
        primaryMetric: "lineMismatchCount",
        secondaryMetric: "lineCountError",
        tertiaryMetric: "maxLineWidthError",
        scoreWeights: {
          lineMismatchCount: 5,
          lineCountError: 7,
          maxLineWidthError: 11
        }
      }
      const optimized = yield* Experimental.Calibration.optimizeProfile({
        cases: canonicalCalibrationCases,
        services: calibrationServices,
        trials: 1,
        sampler: Sampler.grid(),
        searchDescriptor: defaultSearchDescriptor,
        objective
      })

      expect(optimized.optimization.objective).toEqual(objective)
      expect(Schema.is(Experimental.Calibration.CalibrationOptimizationReport)(optimized.optimization)).toBe(true)
      expect(optimized.optimization.bestScore).toBe(manualScore(optimized.bestReport, objective))
    }))
})
