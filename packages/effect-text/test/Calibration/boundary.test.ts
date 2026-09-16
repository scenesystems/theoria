import { describe, expect, it } from "@effect/vitest"
import { Errors as SearchErrors, Sampler } from "@scenesystems/effect-search"
import type { Study } from "@scenesystems/effect-search"
import {
  Array as Arr,
  Boolean as Bool,
  type Context,
  Effect,
  Exit,
  Layer,
  Number as Num,
  Option,
  Ref,
  String as Str
} from "effect"

import * as Calibration from "../../src/Calibration.js"
import * as Hyphenation from "../../src/Hyphenation.js"
import * as MeasurementCache from "../../src/MeasurementCache.js"
import * as Text from "../../src/Text.js"
import * as TextMeasurer from "../../src/TextMeasurer.js"
import {
  calibrationServices,
  canonicalCalibrationCases,
  defaultCalibrationProfile,
  exploratorySearch,
  fixedSearch
} from "./fixtures.js"

const calibrationCaseAt = (index: number) =>
  Arr.get(canonicalCalibrationCases, index).pipe(
    Option.match({
      onNone: () => Effect.fail("CanonicalCalibrationCaseMissing"),
      onSome: Effect.succeed
    })
  )

describe("Calibration boundary contracts", () => {
  it.effect("evaluate composes on top of prepare and pure layout", () =>
    Effect.gen(function*() {
      const mixedDirectionCase = yield* calibrationCaseAt(4)

      const report = yield* Calibration.evaluate(
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
        Option.some(Text.summary(prepared, mixedDirectionCase.layout))
      )
      expect(Arr.head(report.results).pipe(Option.map((result) => result.actualLines))).toEqual(
        Option.some(Text.lines(prepared, mixedDirectionCase.layout))
      )
    }))

  it.effect("optimize does not make layout effectful", () =>
    Effect.gen(function*() {
      const measurementCount = yield* Ref.make(0)
      const countedTextMeasurer: Context.Tag.Service<typeof TextMeasurer.TextMeasurer> = {
        measure: (font, text) =>
          Ref.update(measurementCount, Num.increment).pipe(
            Effect.as(
              Num.multiply(
                Str.length(text),
                Bool.match(Str.Equivalence(font.family, "system-ui"), {
                  onFalse: () => 5,
                  onTrue: () => 10
                })
              )
            )
          )
      }
      const countedMeasurerLayer = Layer.succeed(
        TextMeasurer.TextMeasurer,
        countedTextMeasurer
      )
      const countedServices = Layer.mergeAll(
        Text.layerSegmenter,
        Text.layerProfile,
        Hyphenation.layer(),
        MeasurementCache.layer.pipe(Layer.provide(countedMeasurerLayer))
      )
      const softHyphenCase = yield* calibrationCaseAt(1)

      const prepared = yield* Text.prepareWithSegments(softHyphenCase.prepare).pipe(
        Effect.provide(countedServices)
      )
      const beforeOptimize = yield* Ref.get(measurementCount)

      yield* Calibration.optimize({
        cases: Arr.of(softHyphenCase),
        services: countedServices,
        trials: 1,
        sampler: Sampler.grid(),
        search: fixedSearch
      })

      const afterOptimize = yield* Ref.get(measurementCount)
      const summary = Text.summary(prepared, softHyphenCase.layout)
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

  it.effect("optimize is reproducible for a fixed seed and corpus", () =>
    Effect.gen(function*() {
      const firstRun = yield* Calibration.optimize({
        cases: canonicalCalibrationCases,
        services: calibrationServices,
        trials: 4,
        sampler: Sampler.random({ seed: 17 }),
        search: exploratorySearch
      })
      const secondRun = yield* Calibration.optimize({
        cases: canonicalCalibrationCases,
        services: calibrationServices,
        trials: 4,
        sampler: Sampler.random({ seed: 17 }),
        search: exploratorySearch
      })

      expect(secondRun.bestProfile).toEqual(firstRun.bestProfile)
      expect(secondRun.optimization.bestScore).toBe(firstRun.optimization.bestScore)
      expect(secondRun.optimization.artifacts.eventLog).toEqual(firstRun.optimization.artifacts.eventLog)
    }))

  it.effect("optimize retains NoSuccessfulTrials in the Effect Search failure channel", () =>
    Calibration.optimize({
      cases: canonicalCalibrationCases,
      services: calibrationServices,
      trials: 0,
      sampler: Sampler.grid(),
      search: fixedSearch
    }).pipe(
      Effect.exit,
      Effect.map((exit) =>
        expect(exit).toStrictEqual(Exit.fail(new SearchErrors.NoSuccessfulTrials({ trialCount: 0 })))
      )
    ))

  it.effect("optimize fails with SnapshotMissing when storage drops its snapshot", () =>
    Effect.gen(function*() {
      const trialLog = yield* Ref.make(Arr.empty<Study.SnapshotTrial>())
      const evictingStorage: Study.StudyStorageApi = {
        appendTrial: (trial) => Ref.update(trialLog, (trials) => Arr.append(trials, trial)),
        loadSnapshot: () => Effect.succeedNone,
        loadTrialLog: () => Ref.get(trialLog),
        replayTrialLog: () => Ref.get(trialLog),
        writeSnapshot: () => Effect.void
      }

      const exit = yield* Calibration.optimize({
        cases: canonicalCalibrationCases,
        services: calibrationServices,
        trials: 2,
        sampler: Sampler.random({ seed: 17 }),
        search: exploratorySearch,
        studyStorage: evictingStorage
      }).pipe(Effect.exit)

      expect(exit).toStrictEqual(
        Exit.fail(new Calibration.SnapshotMissing({ trialLogLength: 2 }))
      )
    }))

  it.effect("calibration corpora can assert exact lines for bidi, CJK, tabs, and hyphenation", () =>
    Effect.gen(function*() {
      const report = yield* Calibration.evaluate(
        defaultCalibrationProfile,
        canonicalCalibrationCases
      ).pipe(Effect.provide(calibrationServices))

      expect(report.caseCount).toBe(Arr.length(canonicalCalibrationCases))
      expect(report.matchedCaseCount).toBe(Arr.length(canonicalCalibrationCases))
      expect(report.totalLineMismatchCount).toBe(0)
    }))
})
