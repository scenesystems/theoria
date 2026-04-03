import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { Sampler } from "effect-search"

import { Contracts, Experimental, Text } from "../../src/index.js"

const calibrationLayer = Layer.mergeAll(
  Text.WordSegmenterLive,
  Text.MeasurementCacheLive.pipe(
    Layer.provide(
      Layer.succeed(Contracts.TextMeasurer, {
        measure: (_font, text: string) => Effect.succeed(text.length * 5)
      })
    )
  )
)

describe("Experimental.Calibration", () => {
  it.effect("evaluates candidate engine profiles through the existing prepare/layout split", () =>
    Effect.gen(function*() {
      const report = yield* Experimental.Calibration.evaluateProfile(
        {
          name: "tight-tabs",
          engineProfile: {
            lineFitEpsilon: 0.005,
            tabWidth: 2,
            defaultDirection: "ltr",
            preferEarlySoftHyphenBreak: false,
            preferPrefixWidthsForBreakableRuns: true
          }
        },
        [
          {
            name: "tab-advance",
            prepare: {
              text: "a\tb",
              font: { family: "Mono", size: 10 },
              whiteSpace: "pre-wrap"
            },
            layout: { maxWidth: 100, lineHeight: 12 },
            expected: {
              lineCount: 1,
              maxLineWidth: 15,
              lines: [{ text: "a\tb", width: 15 }]
            }
          },
          {
            name: "greedy-wrap",
            prepare: {
              text: "hello hello",
              font: { family: "Mono", size: 10 },
              whiteSpace: "normal"
            },
            layout: { maxWidth: 40, lineHeight: 12 },
            expected: {
              lineCount: 2,
              maxLineWidth: 40,
              lines: [
                { text: "hello he", width: 40 },
                { text: "llo", width: 15 }
              ]
            }
          }
        ]
      ).pipe(Effect.provide(calibrationLayer))

      expect(report.profile.name).toBe("tight-tabs")
      expect(report.caseCount).toBe(2)
      expect(report.matchedCaseCount).toBe(2)
      expect(report.totalLineCountError).toBe(0)
      expect(report.totalMaxLineWidthError).toBe(0)
      expect(report.totalLineMismatchCount).toBe(0)
      expect(report.results.map((result) => result.actual.maxLineWidth)).toEqual([15, 40])
      expect(report.results[1]?.actualLines).toEqual([
        { index: 0, text: "hello he", width: 40 },
        { index: 1, text: "llo", width: 15 }
      ])
    }))

  it.effect("treats exact expected lines as part of calibration fidelity", () =>
    Effect.gen(function*() {
      const report = yield* Experimental.Calibration.evaluateProfile(
        {
          name: "mismatch-detection",
          engineProfile: {
            lineFitEpsilon: 0.005,
            tabWidth: 2,
            defaultDirection: "ltr",
            preferEarlySoftHyphenBreak: false,
            preferPrefixWidthsForBreakableRuns: true
          }
        },
        [{
          name: "greedy-wrap",
          prepare: {
            text: "hello hello",
            font: { family: "Mono", size: 10 },
            whiteSpace: "normal"
          },
          layout: { maxWidth: 40, lineHeight: 12 },
          expected: {
            lineCount: 2,
            maxLineWidth: 40,
            lines: [
              { text: "hello he", width: 40 },
              { text: "llo!", width: 15 }
            ]
          }
        }]
      ).pipe(Effect.provide(calibrationLayer))

      expect(report.matchedCaseCount).toBe(0)
      expect(report.totalLineCountError).toBe(0)
      expect(report.totalMaxLineWidthError).toBe(0)
      expect(report.totalLineMismatchCount).toBe(1)
      expect(report.results[0]?.matched).toBe(false)
    }))

  it.effect("uses effect-search to optimize candidate engine profiles in the experimental lane", () =>
    Effect.gen(function*() {
      const optimized = yield* Experimental.Calibration.optimizeProfile({
        cases: [{
          name: "tab-advance",
          prepare: {
            text: "a\tb",
            font: { family: "Mono", size: 10 },
            whiteSpace: "pre-wrap"
          },
          layout: { maxWidth: 100, lineHeight: 12 },
          expected: {
            lineCount: 1,
            maxLineWidth: 15,
            lines: [{ text: "a\tb", width: 15 }]
          }
        }],
        services: calibrationLayer,
        trials: 8,
        sampler: Sampler.grid(),
        searchSpaceSpec: {
          lineFitEpsilon: { low: 0.005, high: 0.005, step: 0.001 },
          tabWidth: { low: 2, high: 4, step: 2 }
        }
      })

      expect(optimized.bestProfile.engineProfile.tabWidth).toBe(2)
      expect(optimized.bestReport.matchedCaseCount).toBe(1)
      expect(optimized.bestReport.totalMaxLineWidthError).toBe(0)
      expect(optimized.bestReport.totalLineMismatchCount).toBe(0)
      expect(optimized.studyResult.bestTrial.config.tabWidth).toBe(2)
    }))
})
