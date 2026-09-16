import { describe, expect, it } from "@effect/vitest"
import * as Sampler from "@scenesystems/effect-search/Sampler"
import type * as StudySnapshot from "@scenesystems/effect-search/StudySnapshot"
import type * as StudyStorage from "@scenesystems/effect-search/StudyStorage"
import {
  Array as Arr,
  Boolean as Bool,
  Effect,
  Equal,
  Exit,
  Layer,
  Number as Num,
  Option,
  Ref,
  String as Str
} from "effect"

import { Contracts, Experimental, Text } from "../../src/index.js"
import {
  calibrationServices,
  canonicalCalibrationCases,
  defaultCalibrationProfile,
  defaultSearchDescriptor,
  exploratorySearchDescriptor
} from "./fixtures.js"

describe("Experimental.Calibration boundary contracts", () => {
  it.effect("evaluateProfile composes on top of prepare and pure layout", () =>
    Effect.gen(function*() {
      const mixedDirectionCase = yield* Option.fromNullable(canonicalCalibrationCases[4]).pipe(
        Option.match({
          onNone: () => Effect.dieMessage("missing mixed-direction calibration fixture"),
          onSome: Effect.succeed
        })
      )

      const report = yield* Experimental.Calibration.evaluateProfile(
        defaultCalibrationProfile,
        Arr.of(
          mixedDirectionCase
        )
      ).pipe(
        Effect.provide(calibrationServices)
      )
      const prepared = yield* Text.prepareWithSegments(mixedDirectionCase.prepare).pipe(
        Effect.provide(calibrationServices)
      )

      expect(report.matchedCaseCount).toBe(1)
      expect(Arr.head(report.results).pipe(Option.map((result) => result.actual))).toEqual(
        Option.some(Text.layout(prepared, mixedDirectionCase.layout))
      )
      expect(Arr.head(report.results).pipe(Option.map((result) => result.actualLines))).toEqual(
        Option.some(Text.layoutLines(prepared, mixedDirectionCase.layout))
      )
    }))

  it.effect("optimizeProfile does not make layout effectful", () =>
    Effect.gen(function*() {
      const measurementCount = yield* Ref.make(0)
      const countedMeasurerLayer = Layer.succeed(Contracts.TextMeasurer, {
        measure: (font: Text.FontDescriptorType, text: string) =>
          Ref.update(measurementCount, Num.increment).pipe(
            Effect.as(
              Num.multiply(
                Str.length(text),
                Bool.match(Equal.equals(font.family, "system-ui"), { onTrue: () => 10, onFalse: () => 5 })
              )
            )
          )
      })
      const countedServices = Layer.mergeAll(
        Text.WordSegmenterLive,
        Text.EngineProfileLive,
        Text.HyphenationDictionaryLive(),
        Text.MeasurementCacheLive.pipe(Layer.provide(countedMeasurerLayer))
      )
      const softHyphenCase = yield* Option.fromNullable(canonicalCalibrationCases[1]).pipe(
        Option.match({
          onNone: () => Effect.dieMessage("missing soft-hyphen calibration fixture"),
          onSome: Effect.succeed
        })
      )

      const prepared = yield* Text.prepareWithSegments(softHyphenCase.prepare).pipe(
        Effect.provide(countedServices)
      )
      const beforeOptimize = yield* Ref.get(measurementCount)

      yield* Experimental.Calibration.optimizeProfile({
        cases: Arr.of(softHyphenCase),
        services: countedServices,
        trials: 1,
        sampler: Sampler.grid(),
        searchDescriptor: defaultSearchDescriptor
      })

      const afterOptimize = yield* Ref.get(measurementCount)
      const summary = Text.layout(prepared, softHyphenCase.layout)
      const afterLayout = yield* Ref.get(measurementCount)

      expect(beforeOptimize).toBeGreaterThan(0)
      expect(afterOptimize).toBeGreaterThan(beforeOptimize)
      expect(afterLayout).toBe(afterOptimize)
      expect(summary).toEqual({
        height: 24,
        lineCount: 2,
        maxLineWidth: 30
      })
    }))

  it.effect("optimizeProfile is reproducible for a fixed seed and corpus", () =>
    Effect.gen(function*() {
      const firstRun = yield* Experimental.Calibration.optimizeProfile({
        cases: canonicalCalibrationCases,
        services: calibrationServices,
        trials: 4,
        sampler: Sampler.random({ seed: 17 }),
        searchDescriptor: exploratorySearchDescriptor
      })
      const secondRun = yield* Experimental.Calibration.optimizeProfile({
        cases: canonicalCalibrationCases,
        services: calibrationServices,
        trials: 4,
        sampler: Sampler.random({ seed: 17 }),
        searchDescriptor: exploratorySearchDescriptor
      })

      expect(secondRun.bestProfile).toEqual(firstRun.bestProfile)
      expect(secondRun.optimization.bestScore).toBe(firstRun.optimization.bestScore)
      expect(secondRun.optimization.artifacts.eventLog).toEqual(firstRun.optimization.artifacts.eventLog)
    }))

  it.effect("optimizeProfile fails with CalibrationSnapshotMissing when storage drops its snapshot", () =>
    Effect.gen(function*() {
      const trialLog = yield* Ref.make(Arr.empty<StudySnapshot.Trial>())
      const evictingStorage: StudyStorage.Service = {
        appendTrial: (trial) => Ref.update(trialLog, Arr.append(trial)),
        loadSnapshot: () => Effect.succeedNone,
        loadTrialLog: () => Ref.get(trialLog),
        replayTrialLog: () => Ref.get(trialLog),
        writeSnapshot: () => Effect.void
      }

      const exit = yield* Experimental.Calibration.optimizeProfile({
        cases: canonicalCalibrationCases,
        services: calibrationServices,
        trials: 2,
        sampler: Sampler.random({ seed: 17 }),
        searchDescriptor: exploratorySearchDescriptor,
        studyStorage: evictingStorage
      }).pipe(Effect.exit)

      expect(exit).toStrictEqual(
        Exit.fail(new Experimental.Calibration.CalibrationSnapshotMissing({ trialLogLength: 2 }))
      )
    }))

  it.effect("experimental calibration corpora can assert exact lines for bidi, CJK, tabs, and hyphenation", () =>
    Effect.gen(function*() {
      const report = yield* Experimental.Calibration.evaluateProfile(
        defaultCalibrationProfile,
        canonicalCalibrationCases
      ).pipe(Effect.provide(calibrationServices))

      expect(report.caseCount).toBe(Arr.length(canonicalCalibrationCases))
      expect(report.matchedCaseCount).toBe(Arr.length(canonicalCalibrationCases))
      expect(report.totalLineMismatchCount).toBe(0)
    }))
})
