import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Number as Num, Schema } from "effect"
import * as Arr from "effect/Array"
import * as Str from "effect/String"

import { Contracts, Errors, Experimental, Text } from "../../src/index.js"

const constructCalibrationCase = Schema.decodeSync(Experimental.Calibration.CalibrationCase)
const constructCalibrationProfile = Schema.decodeSync(Experimental.Calibration.CalibrationProfile)

const profile = constructCalibrationProfile({
  name: "behavioral-profile",
  engineProfile: {
    lineFitEpsilon: 0.005,
    tabWidth: 4,
    defaultDirection: "ltr",
    preferEarlySoftHyphenBreak: false,
    preferPrefixWidthsForBreakableRuns: true
  }
})

const orderedCases = Arr.make(
  constructCalibrationCase({
    name: "two-lines-first",
    prepare: {
      text: "a\nbb",
      font: { family: "Mono", size: 10 },
      whiteSpace: "pre-wrap"
    },
    layout: { maxWidth: 100, lineHeight: 12 },
    expected: {
      lineCount: 1,
      maxLineWidth: 7,
      lines: Arr.make(
        { text: "bb", width: 20 },
        { text: "a", width: 10 }
      )
    }
  }),
  constructCalibrationCase({
    name: "one-line-second",
    prepare: {
      text: "ccc",
      font: { family: "Mono", size: 10 },
      whiteSpace: "normal"
    },
    layout: { maxWidth: 100, lineHeight: 12 },
    expected: {
      lineCount: 4,
      maxLineWidth: 50
    }
  })
)

const measuringServices = Layer.merge(
  Text.WordSegmenterLive,
  Layer.succeed(Contracts.MeasurementCache, {
    measure: (_font, text) => Effect.succeed(Num.multiply(Str.length(text), 10))
  })
)

describe("Experimental.Calibration fixed-profile evaluation", () => {
  it.effect("retains corpus and visual-line order while aggregating asymmetric errors", () =>
    Effect.gen(function*() {
      const report = yield* Experimental.Calibration.evaluateProfile(profile, orderedCases).pipe(
        Effect.provide(measuringServices)
      )

      expect(report.caseCount).toBe(2)
      expect(report.matchedCaseCount).toBe(0)
      expect(report.totalLineCountError).toBe(4)
      expect(report.totalMaxLineWidthError).toBe(33)
      expect(report.totalLineMismatchCount).toBe(2)
      expect(Arr.map(report.results, (result) => result.name)).toEqual(
        Arr.make("two-lines-first", "one-line-second")
      )
      expect(Arr.map(Arr.flatMap(report.results, (result) => result.actualLines), (line) => line.text)).toEqual(
        Arr.make("a", "bb", "ccc")
      )
      expect(Arr.map(report.results, (result) => result.lineCountDelta)).toEqual(Arr.make(1, -3))
      expect(Arr.map(report.results, (result) => result.maxLineWidthDelta)).toEqual(Arr.make(13, -20))
    }))

  it.effect("preserves MeasurementFailed in the typed failure channel", () =>
    Effect.gen(function*() {
      const failedMeasurement = new Errors.MeasurementFailed({
        fontFamily: "Mono",
        fontSize: 10,
        text: "failure",
        reason: "measurement unavailable"
      })
      const failingServices = Layer.merge(
        Text.WordSegmenterLive,
        Layer.succeed(Contracts.MeasurementCache, {
          measure: () => Effect.fail(failedMeasurement)
        })
      )
      const failingCase = constructCalibrationCase({
        name: "typed-measurement-failure",
        prepare: {
          text: "failure",
          font: { family: "Mono", size: 10 },
          whiteSpace: "normal"
        },
        layout: { maxWidth: 100, lineHeight: 12 },
        expected: { lineCount: 1, maxLineWidth: 70 }
      })

      const failure: Errors.MeasurementFailed = yield* Experimental.Calibration.evaluateProfile(
        profile,
        Arr.make(failingCase)
      ).pipe(
        Effect.provide(failingServices),
        Effect.flip
      )

      expect(failure).toStrictEqual(failedMeasurement)
    }))
})
