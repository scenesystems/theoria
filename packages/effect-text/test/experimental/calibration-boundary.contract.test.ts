import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Option, Ref } from "effect"
import { Sampler } from "effect-search"

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
      const mixedDirectionCase = Option.fromNullable(canonicalCalibrationCases[4])
      expect(Option.isSome(mixedDirectionCase)).toBe(true)

      if (Option.isNone(mixedDirectionCase)) {
        return
      }

      const report = yield* Experimental.Calibration.evaluateProfile(defaultCalibrationProfile, [
        mixedDirectionCase.value
      ]).pipe(
        Effect.provide(calibrationServices)
      )
      const prepared = yield* Text.prepareWithSegments(mixedDirectionCase.value.prepare).pipe(
        Effect.provide(calibrationServices)
      )

      expect(report.matchedCaseCount).toBe(1)
      expect(report.results[0]?.actual).toEqual(Text.layout(prepared, mixedDirectionCase.value.layout))
      expect(report.results[0]?.actualLines).toEqual(Text.layoutLines(prepared, mixedDirectionCase.value.layout))
    }))

  it.effect("optimizeProfile does not make layout effectful", () =>
    Effect.gen(function*() {
      const measurementCount = yield* Ref.make(0)
      const countedMeasurerLayer = Layer.succeed(Contracts.TextMeasurer, {
        measure: (font: Text.FontDescriptorType, text: string) =>
          Ref.update(measurementCount, (count) => count + 1).pipe(
            Effect.as(text.length * (font.family === "system-ui" ? 10 : 5))
          )
      })
      const countedServices = Layer.mergeAll(
        Text.WordSegmenterLive,
        Text.EngineProfileLive,
        Text.HyphenationDictionaryLive(),
        Text.MeasurementCacheLive.pipe(Layer.provide(countedMeasurerLayer))
      )
      const softHyphenCase = Option.fromNullable(canonicalCalibrationCases[1])
      expect(Option.isSome(softHyphenCase)).toBe(true)

      if (Option.isNone(softHyphenCase)) {
        return
      }

      const prepared = yield* Text.prepareWithSegments(softHyphenCase.value.prepare).pipe(
        Effect.provide(countedServices)
      )
      const beforeOptimize = yield* Ref.get(measurementCount)

      yield* Experimental.Calibration.optimizeProfile({
        cases: [softHyphenCase.value],
        services: countedServices,
        trials: 1,
        sampler: Sampler.grid(),
        searchDescriptor: defaultSearchDescriptor
      })

      const afterOptimize = yield* Ref.get(measurementCount)
      const summary = Text.layout(prepared, softHyphenCase.value.layout)
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

  it.effect("experimental calibration corpora can assert exact lines for bidi, CJK, browser parity, and hyphenation cases", () =>
    Effect.gen(function*() {
      const report = yield* Experimental.Calibration.evaluateProfile(
        defaultCalibrationProfile,
        canonicalCalibrationCases
      ).pipe(Effect.provide(calibrationServices))

      expect(report.caseCount).toBe(canonicalCalibrationCases.length)
      expect(report.matchedCaseCount).toBe(canonicalCalibrationCases.length)
      expect(report.totalLineMismatchCount).toBe(0)
    }))
})
