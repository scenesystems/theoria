import { FileSystem } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { OptimizationStorage, Sampler } from "@scenesystems/effect-search"
import { StudyStorage } from "@scenesystems/effect-study"
import { Array as Arr, Effect, Number as Num, Option, Schema } from "effect"

import {
  calibrationServices,
  canonicalCalibrationCases,
  canonicalTabAdvancesCase,
  defaultCalibrationProfile,
  exploratorySearch,
  fixedSearch
} from "../../examples/live/calibrationFixtures.js"
import * as Calibration from "../../src/Calibration.js"

const manualScore = (
  report: Calibration.Report,
  objective: Calibration.Objective
): number =>
  Numeric.sum(
    Arr.map(report.results, (result) =>
      Numeric.sum(Arr.make(
        Num.multiply(result.lineMismatchCount, objective.scoreWeights.lineMismatchCount),
        Num.multiply(Numeric.abs(result.lineCountDelta), objective.scoreWeights.lineCountError),
        Num.multiply(Numeric.abs(result.maxLineWidthDelta), objective.scoreWeights.maxLineWidthError)
      )))
  )

const makeOptimizationStorage = (directory: string) =>
  OptimizationStorage.makeFileSystem(
    StudyStorage.fileSystemOptions(directory, "optimization-storage.jsonl")
  )

describe("Calibration reporting contracts", () => {
  it.effect("an explicitly empty expected layout matches empty text without a phantom line mismatch", () =>
    Effect.gen(function*() {
      const report = yield* Calibration.evaluate(
        defaultCalibrationProfile,
        Arr.of({
          name: "empty-layout",
          prepare: { text: "", font: { family: "Mono", size: 10 }, whiteSpace: "normal" },
          layout: { maxWidth: 20, lineHeight: 12 },
          expected: { lineCount: 0, maxLineWidth: 0, lines: Arr.empty() }
        })
      ).pipe(Effect.provide(calibrationServices))

      expect(report.matchedCaseCount).toBe(1)
      expect(report.totalLineMismatchCount).toBe(0)
      expect(Arr.map(report.results, (result) => result.actualLines)).toEqual(Arr.of(Arr.empty()))
    }))

  it.effect("evaluation retains asymmetric signed deltas and distinguishes absent from empty expected lines", () =>
    Effect.gen(function*() {
      const report = yield* Calibration.evaluate(
        {
          name: "signed-error-boundaries",
          profile: {
            lineFitEpsilon: 0.005,
            tabWidth: 4,
            defaultDirection: "ltr",
            preferEarlySoftHyphenBreak: false,
            preferPrefixWidthsForBreakableRuns: true
          }
        },
        Arr.make(
          {
            ...canonicalTabAdvancesCase,
            name: "negative-deltas-without-line-expectations",
            expected: {
              lineCount: Num.increment(canonicalTabAdvancesCase.expected.lineCount),
              maxLineWidth: Num.sum(canonicalTabAdvancesCase.expected.maxLineWidth, 1)
            }
          },
          {
            ...canonicalTabAdvancesCase,
            name: "positive-deltas-with-empty-line-expectations",
            expected: {
              lineCount: Num.decrement(canonicalTabAdvancesCase.expected.lineCount),
              maxLineWidth: Num.subtract(canonicalTabAdvancesCase.expected.maxLineWidth, 1),
              lines: Arr.empty()
            }
          }
        )
      ).pipe(Effect.provide(calibrationServices))

      expect(
        Arr.map(report.results, (result) => ({
          lineCountDelta: result.lineCountDelta,
          maxLineWidthDelta: result.maxLineWidthDelta,
          lineMismatchCount: result.lineMismatchCount,
          matched: result.matched
        }))
      ).toEqual(Arr.make(
        {
          lineCountDelta: Num.negate(1),
          maxLineWidthDelta: Num.negate(1),
          lineMismatchCount: 0,
          matched: false
        },
        {
          lineCountDelta: 1,
          maxLineWidthDelta: 1,
          lineMismatchCount: 1,
          matched: false
        }
      ))
    }))

  it.effect("optimize emits an OptimizationSnapshot and ordered OptimizationEvent log", () =>
    Effect.gen(function*() {
      const optimized = yield* Calibration.optimize({
        cases: canonicalCalibrationCases,
        services: calibrationServices,
        trials: 2,
        sampler: Sampler.grid(),
        search: fixedSearch
      })

      expect(Schema.is(Calibration.OptimizationArtifacts)(optimized.optimization.artifacts)).toBe(true)
      expect(
        Arr.head(optimized.optimization.artifacts.eventLog).pipe(Option.map((event) => event._tag))
      ).toEqual(Option.some("TrialStarted"))
      expect(
        Arr.last(optimized.optimization.artifacts.eventLog).pipe(Option.map((event) => event._tag))
      ).toEqual(Option.some("Completed"))
      expect(optimized.optimization.artifacts.snapshot.completedCount).toBe(2)
    }))

  it.effect("optimization studies resume from a snapshot without changing the winning profile", () =>
    Effect.gen(function*() {
      const baseline = yield* Calibration.optimize({
        cases: canonicalCalibrationCases,
        services: calibrationServices,
        trials: 4,
        sampler: Sampler.random({ seed: 91 }),
        search: exploratorySearch
      })
      const firstLeg = yield* Calibration.optimize({
        cases: canonicalCalibrationCases,
        services: calibrationServices,
        trials: 2,
        sampler: Sampler.random({ seed: 91 }),
        search: exploratorySearch
      })
      const resumed = yield* Calibration.optimize({
        cases: canonicalCalibrationCases,
        services: calibrationServices,
        trials: 2,
        sampler: Sampler.random({ seed: 91 }),
        search: exploratorySearch,
        snapshot: firstLeg.optimization.artifacts.snapshot
      })

      expect(resumed.bestProfile).toEqual(baseline.bestProfile)
      expect(resumed.optimization.bestScore).toBe(baseline.optimization.bestScore)
      expect(
        Arr.head(resumed.optimization.artifacts.eventLog).pipe(Option.map((event) => event._tag))
      ).toEqual(Option.some("TrialStarted"))
      expect(
        Arr.last(resumed.optimization.artifacts.eventLog).pipe(Option.map((event) => event._tag))
      ).toEqual(Option.some("Completed"))
      expect(resumed.optimization.artifacts.snapshot.completedCount).toBe(4)
    }))

  it.effect("zero-trial continuation reconstructs the stored optimization result", () =>
    Effect.gen(function*() {
      const firstLeg = yield* Calibration.optimize({
        cases: canonicalCalibrationCases,
        services: calibrationServices,
        trials: 2,
        sampler: Sampler.random({ seed: 91 }),
        search: exploratorySearch
      })
      const reconstructed = yield* Calibration.optimize({
        cases: canonicalCalibrationCases,
        services: calibrationServices,
        trials: 0,
        sampler: Sampler.random({ seed: 91 }),
        search: exploratorySearch,
        snapshot: firstLeg.optimization.artifacts.snapshot
      })

      expect(reconstructed.bestProfile).toEqual(firstLeg.bestProfile)
      expect(reconstructed.optimization.bestScore).toBe(firstLeg.optimization.bestScore)
      expect(reconstructed.optimization.artifacts.snapshot.completedCount).toBe(2)
      expect(
        Arr.last(reconstructed.optimization.artifacts.eventLog).pipe(Option.map((event) => event._tag))
      ).toEqual(Option.some("Completed"))
    }))

  it.effect("optimizations can persist and resume through effect-search OptimizationStorage", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const fileSystem = yield* FileSystem.FileSystem
        const directory = yield* fileSystem.makeTempDirectoryScoped({
          prefix: "effect-text-calibration-study-"
        })
        const firstLegStorage = yield* makeOptimizationStorage(directory)
        const firstLeg = yield* Calibration.optimize({
          cases: canonicalCalibrationCases,
          services: calibrationServices,
          trials: 2,
          sampler: Sampler.random({ seed: 91 }),
          search: exploratorySearch,
          optimizationStorage: firstLegStorage
        })
        const resumedStorage = yield* makeOptimizationStorage(directory)
        const resumed = yield* Calibration.optimize({
          cases: canonicalCalibrationCases,
          services: calibrationServices,
          trials: 2,
          sampler: Sampler.random({ seed: 91 }),
          search: exploratorySearch,
          snapshot: firstLeg.optimization.artifacts.snapshot,
          optimizationStorage: resumedStorage
        })
        const persistedSnapshot = yield* resumedStorage.loadSnapshot()
        const persistedTrials = yield* resumedStorage.loadTrialLog()

        expect(Option.isSome(persistedSnapshot)).toBe(true)
        expect(persistedTrials).toHaveLength(4)
        expect(resumed.optimization.artifacts.snapshot.completedCount).toBe(4)
        expect(
          Arr.head(resumed.optimization.artifacts.eventLog).pipe(Option.map((event) => event._tag))
        ).toEqual(Option.some("TrialStarted"))
        expect(
          Arr.last(resumed.optimization.artifacts.eventLog).pipe(Option.map((event) => event._tag))
        ).toEqual(Option.some("Completed"))
        expect(persistedSnapshot.pipe(Option.map((snapshot) => snapshot.completedCount))).toEqual(Option.some(4))
        expect(persistedSnapshot.pipe(Option.map((snapshot) => snapshot.nextTrialNumber))).toEqual(Option.some(4))
      }).pipe(Effect.provide(BunContext.layer))
    ))

  it.effect("score weights and objective metadata are explicit inputs rather than hidden constants", () =>
    Effect.gen(function*() {
      const objective: Calibration.Objective = {
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
      const optimized = yield* Calibration.optimize({
        cases: canonicalCalibrationCases,
        services: calibrationServices,
        trials: 1,
        sampler: Sampler.grid(),
        search: fixedSearch,
        objective
      })

      expect(optimized.optimization.objective).toEqual(objective)
      expect(Schema.is(Calibration.OptimizationReport)(optimized.optimization)).toBe(true)
      expect(optimized.optimization.bestScore).toBe(manualScore(optimized.bestReport, objective))
    }))
})
