import { FileSystem } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Contracts as SearchContracts, Sampler, Study } from "@scenesystems/effect-search"
import { Array as Arr, Effect, Layer, Number as Num, Option, Schema } from "effect"

import * as Calibration from "../../src/Calibration.js"
import {
  calibrationServices,
  canonicalCalibrationCases,
  defaultCalibrationProfile,
  exploratorySearch,
  fixedSearch
} from "./fixtures.js"

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

const makeEnvelopeContextLayer = (runIdText: string, studyId: string) =>
  Effect.gen(function*() {
    const packageVersion = yield* Schema.decode(SearchContracts.PackageVersion)("0.2.0")
    const runId = yield* Schema.decode(SearchContracts.RunId)(runIdText)

    return SearchContracts.EnvelopeContextLive({
      packageVersion,
      runId,
      studyId
    })
  }).pipe(Layer.unwrapEffect)

const makeStudyStorage = (directory: string, runIdText: string, studyId: string) =>
  Study.makeStudyStorage(Study.studyStorageOptions(directory)).pipe(
    Effect.provide(Layer.merge(SearchContracts.fileSystemSink(directory), makeEnvelopeContextLayer(runIdText, studyId)))
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
      const calibrationCase = yield* Arr.get(canonicalCalibrationCases, 0).pipe(
        Option.match({
          onNone: () => Effect.fail("CanonicalCalibrationCaseMissing"),
          onSome: Effect.succeed
        })
      )
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
            ...calibrationCase,
            name: "negative-deltas-without-line-expectations",
            expected: {
              lineCount: Num.increment(calibrationCase.expected.lineCount),
              maxLineWidth: Num.sum(calibrationCase.expected.maxLineWidth, 1)
            }
          },
          {
            ...calibrationCase,
            name: "positive-deltas-with-empty-line-expectations",
            expected: {
              lineCount: Num.decrement(calibrationCase.expected.lineCount),
              maxLineWidth: Num.subtract(calibrationCase.expected.maxLineWidth, 1),
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

  it.effect("optimize emits a StudySnapshot and ordered StudyEvent log", () =>
    Effect.gen(function*() {
      const optimized = yield* Calibration.optimize({
        cases: canonicalCalibrationCases,
        services: calibrationServices,
        trials: 2,
        sampler: Sampler.grid(),
        search: fixedSearch
      })

      expect(Schema.is(Calibration.StudyArtifacts)(optimized.optimization.artifacts)).toBe(true)
      expect(
        Arr.head(optimized.optimization.artifacts.eventLog).pipe(Option.map((event) => event._tag))
      ).toEqual(Option.some("TrialStarted"))
      expect(
        Arr.last(optimized.optimization.artifacts.eventLog).pipe(Option.map((event) => event._tag))
      ).toEqual(Option.some("StudyCompleted"))
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
      ).toEqual(Option.some("StudyCompleted"))
      expect(resumed.optimization.artifacts.snapshot.completedCount).toBe(4)
    }))

  it.effect("optimization studies can persist and resume through effect-search StudyStorage", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const fileSystem = yield* FileSystem.FileSystem
        const directory = yield* fileSystem.makeTempDirectoryScoped({
          prefix: "effect-text-calibration-study-"
        })
        const firstLegStorage = yield* makeStudyStorage(
          directory,
          "01HZ0000000000000000000000",
          "effect-text-calibration-first-leg"
        )
        const firstLeg = yield* Calibration.optimize({
          cases: canonicalCalibrationCases,
          services: calibrationServices,
          trials: 2,
          sampler: Sampler.random({ seed: 91 }),
          search: exploratorySearch,
          studyStorage: firstLegStorage
        })
        const resumedStorage = yield* makeStudyStorage(
          directory,
          "01HZ0000000000000000000001",
          "effect-text-calibration-resume-leg"
        )
        const resumed = yield* Calibration.optimize({
          cases: canonicalCalibrationCases,
          services: calibrationServices,
          trials: 2,
          sampler: Sampler.random({ seed: 91 }),
          search: exploratorySearch,
          snapshot: firstLeg.optimization.artifacts.snapshot,
          studyStorage: resumedStorage
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
        ).toEqual(Option.some("StudyCompleted"))
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
