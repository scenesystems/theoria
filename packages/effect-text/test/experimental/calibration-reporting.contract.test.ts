import { FileSystem } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import * as OptimizationStorage from "@scenesystems/effect-search/OptimizationStorage"
import * as Sampler from "@scenesystems/effect-search/Sampler"
import * as StudyStorage from "@scenesystems/effect-study/StudyStorage"
import { Array as Arr, Effect, Number as Num, Option, Schema } from "effect"

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
  Numeric.sum(
    Arr.map(report.results, (result) =>
      Numeric.sum(Arr.make(
        Num.multiply(result.lineMismatchCount, objective.scoreWeights.lineMismatchCount),
        Num.multiply(Numeric.abs(result.lineCountDelta), objective.scoreWeights.lineCountError),
        Num.multiply(Numeric.abs(result.maxLineWidthDelta), objective.scoreWeights.maxLineWidthError)
      )))
  )

const makeOptimizationStorage = (options: {
  readonly directory: string
}) =>
  OptimizationStorage.makeFileSystem(
    StudyStorage.fileSystemOptions(options.directory, "optimization-storage.jsonl")
  )

describe("Experimental.Calibration reporting contracts", () => {
  it.effect("optimizeProfile emits an OptimizationSnapshot and ordered OptimizationEvent log", () =>
    Effect.gen(function*() {
      const optimized = yield* Experimental.Calibration.optimizeProfile({
        cases: canonicalCalibrationCases,
        services: calibrationServices,
        trials: 2,
        sampler: Sampler.grid(),
        searchDescriptor: defaultSearchDescriptor
      })

      expect(Schema.is(Experimental.Calibration.CalibrationStudyArtifacts)(optimized.optimization.artifacts))
        .toBe(
          true
        )
      expect(Arr.head(optimized.optimization.artifacts.eventLog).pipe(Option.map((event) => event._tag))).toEqual(
        Option.some("TrialStarted")
      )
      expect(Arr.last(optimized.optimization.artifacts.eventLog).pipe(Option.map((event) => event._tag))).toEqual(
        Option.some("Completed")
      )
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
      expect(Arr.head(resumed.optimization.artifacts.eventLog).pipe(Option.map((event) => event._tag))).toEqual(
        Option.some("TrialStarted")
      )
      expect(Arr.last(resumed.optimization.artifacts.eventLog).pipe(Option.map((event) => event._tag))).toEqual(
        Option.some("Completed")
      )
      expect(resumed.optimization.artifacts.snapshot.completedCount).toBe(4)
    }))

  it.scoped("optimizations can persist and resume through effect-search OptimizationStorage", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const directory = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "effect-text-calibration-study-"
      })
      const firstLegStorage = yield* makeOptimizationStorage({
        directory
      })
      const firstLeg = yield* Experimental.Calibration.optimizeProfile({
        cases: canonicalCalibrationCases,
        services: calibrationServices,
        trials: 2,
        sampler: Sampler.random({ seed: 91 }),
        searchDescriptor: exploratorySearchDescriptor,
        studyStorage: firstLegStorage
      })
      const resumedStorage = yield* makeOptimizationStorage({
        directory
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
      expect(Arr.head(resumed.optimization.artifacts.eventLog).pipe(Option.map((event) => event._tag))).toEqual(
        Option.some("TrialStarted")
      )
      expect(Arr.last(resumed.optimization.artifacts.eventLog).pipe(Option.map((event) => event._tag))).toEqual(
        Option.some("Completed")
      )

      yield* Option.match(persistedSnapshot, {
        onNone: () => Effect.dieMessage("study storage did not persist a snapshot"),
        onSome: (snapshot) =>
          Effect.sync(() => {
            expect(snapshot.completedCount).toBe(4)
            expect(snapshot.nextTrialNumber).toBe(4)
          })
      })
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
