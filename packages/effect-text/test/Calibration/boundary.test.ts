import { describe, expect, it } from "@effect/vitest"
import { Sampler, SearchError } from "@scenesystems/effect-search"
import type * as OptimizationSnapshot from "@scenesystems/effect-search/OptimizationSnapshot"
import type * as OptimizationStorage from "@scenesystems/effect-search/OptimizationStorage"
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

import {
  calibrationServices,
  canonicalCalibrationCases,
  canonicalMixedDirectionCase,
  canonicalSoftHyphenWrapCase,
  defaultCalibrationProfile,
  exploratorySearch,
  fixedSearch
} from "../../examples/live/calibrationFixtures.js"
import * as Calibration from "../../src/Calibration.js"
import * as Hyphenation from "../../src/Hyphenation.js"
import * as MeasurementCache from "../../src/MeasurementCache.js"
import * as Text from "../../src/Text.js"
import * as TextMeasurer from "../../src/TextMeasurer.js"

describe("Calibration boundary contracts", () => {
  it.effect("evaluate composes on top of prepare and pure layout", () =>
    Effect.gen(function*() {
      const report = yield* Calibration.evaluate(
        defaultCalibrationProfile,
        Arr.of(
          canonicalMixedDirectionCase
        )
      ).pipe(
        Effect.provide(calibrationServices)
      )
      const prepared = yield* Text.prepareWithSegments(canonicalMixedDirectionCase.prepare).pipe(
        Effect.provide(calibrationServices)
      )

      expect(report.matchedCaseCount).toBe(1)
      expect(Arr.head(report.results).pipe(Option.map((result) => result.actual))).toEqual(
        Option.some(Text.summary(prepared, canonicalMixedDirectionCase.layout))
      )
      expect(Arr.head(report.results).pipe(Option.map((result) => result.actualLines))).toEqual(
        Option.some(Text.lines(prepared, canonicalMixedDirectionCase.layout))
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
      const prepared = yield* Text.prepareWithSegments(canonicalSoftHyphenWrapCase.prepare).pipe(
        Effect.provide(countedServices)
      )
      const beforeOptimize = yield* Ref.get(measurementCount)

      yield* Calibration.optimize({
        cases: Arr.of(canonicalSoftHyphenWrapCase),
        services: countedServices,
        trials: 1,
        sampler: Sampler.grid(),
        search: fixedSearch
      })

      const afterOptimize = yield* Ref.get(measurementCount)
      const summary = Text.summary(prepared, canonicalSoftHyphenWrapCase.layout)
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
      Effect.map((exit) => expect(exit).toStrictEqual(Exit.fail(new SearchError.NoSuccessfulTrials({ trialCount: 0 }))))
    ))

  it.effect("optimize fails with OptimizationSnapshotMissing when storage drops its snapshot", () =>
    Effect.gen(function*() {
      const trialLog = yield* Ref.make(Arr.empty<OptimizationSnapshot.Trial>())
      const evictingStorage: OptimizationStorage.Service = {
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
        optimizationStorage: evictingStorage
      }).pipe(Effect.exit)

      expect(exit).toStrictEqual(
        Exit.fail(new Calibration.OptimizationSnapshotMissing({ trialLogLength: 2 }))
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
