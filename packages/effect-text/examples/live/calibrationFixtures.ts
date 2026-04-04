import { Effect, Layer } from "effect"

import { Contracts, Text } from "../../src/index.js"
import type { Experimental } from "../../src/index.js"

const advanceForFamily = (family: string): number => family === "system-ui" ? 10 : 5

export const calibrationTextMeasurerLayer = Layer.succeed(Contracts.TextMeasurer, {
  measure: (font: Text.FontDescriptorType, text: string) => Effect.succeed(text.length * advanceForFamily(font.family))
})

export const calibrationServices = Layer.mergeAll(
  Text.WordSegmenterLive,
  Text.EngineProfileLive,
  Text.HyphenationDictionaryLive(),
  Text.MeasurementCacheLive.pipe(Layer.provide(calibrationTextMeasurerLayer))
)

export const defaultCalibrationProfile: Experimental.Calibration.CalibrationProfileType = {
  name: "default-engine-profile",
  engineProfile: {
    lineFitEpsilon: 0.005,
    tabWidth: 4,
    defaultDirection: "ltr",
    preferEarlySoftHyphenBreak: false,
    preferPrefixWidthsForBreakableRuns: true
  }
}

export const canonicalCalibrationCases: ReadonlyArray<Experimental.Calibration.CalibrationCaseType> = [
  {
    name: "browser-parity-tab-advances",
    prepare: {
      text: "a\tb",
      font: { family: "system-ui", size: 10 },
      whiteSpace: "pre-wrap"
    },
    layout: { maxWidth: 100, lineHeight: 12 },
    expected: {
      lineCount: 1,
      maxLineWidth: 50,
      lines: [{ text: "a\tb", width: 50 }]
    }
  },
  {
    name: "soft-hyphen-wrap",
    prepare: {
      text: "alpha\u00adbeta",
      font: { family: "Mono", size: 10 },
      whiteSpace: "normal"
    },
    layout: { maxWidth: 30, lineHeight: 12 },
    expected: {
      lineCount: 2,
      maxLineWidth: 30,
      lines: [
        { text: "alpha-", width: 30 },
        { text: "beta", width: 20 }
      ]
    }
  },
  {
    name: "long-token-grapheme-fallback",
    prepare: {
      text: "https://example.com/a-b?x=1,2",
      font: { family: "Mono", size: 10 },
      whiteSpace: "normal"
    },
    layout: { maxWidth: 25, lineHeight: 12 },
    expected: {
      lineCount: 6,
      maxLineWidth: 25,
      lines: [
        { text: "https", width: 25 },
        { text: "://ex", width: 25 },
        { text: "ample", width: 25 },
        { text: ".com/", width: 25 },
        { text: "a-b?x", width: 25 },
        { text: "=1,2", width: 20 }
      ]
    }
  },
  {
    name: "cjk-no-space-layout",
    prepare: {
      text: "你好世界你好",
      font: { family: "Mono", size: 10 },
      whiteSpace: "normal"
    },
    layout: { maxWidth: 15, lineHeight: 12 },
    expected: {
      lineCount: 2,
      maxLineWidth: 15,
      lines: [
        { text: "你好世", width: 15 },
        { text: "界你好", width: 15 }
      ]
    }
  },
  {
    name: "mixed-direction-browser-case",
    prepare: {
      text: "(שלום) hello",
      font: { family: "system-ui", size: 10 },
      whiteSpace: "normal"
    },
    layout: { maxWidth: 200, lineHeight: 12 },
    expected: {
      lineCount: 1,
      maxLineWidth: 120,
      lines: [{ text: "hello (םולש)", width: 120 }]
    }
  },
  {
    name: "dictionary-hyphenation",
    prepare: {
      text: "hyphenation",
      font: { family: "Mono", size: 10 },
      hyphenationLocale: "en-us",
      whiteSpace: "normal"
    },
    layout: { maxWidth: 30, lineHeight: 12 },
    expected: {
      lineCount: 3,
      maxLineWidth: 25,
      lines: [
        { text: "hy-", width: 15 },
        { text: "phen-", width: 25 },
        { text: "ation", width: 25 }
      ]
    }
  }
]

export const defaultSearchDescriptor: Experimental.Calibration.CalibrationSearchDescriptorType = {
  lineFitEpsilon: { low: 0.005, high: 0.005, step: 0.001 },
  tabWidth: { low: 4, high: 4, step: 1 },
  defaultDirection: { values: ["ltr", "rtl"] },
  preferEarlySoftHyphenBreak: { values: [false] },
  preferPrefixWidthsForBreakableRuns: { values: [true] }
}

export const exploratorySearchDescriptor: Experimental.Calibration.CalibrationSearchDescriptorType = {
  lineFitEpsilon: { low: 0.005, high: 0.005, step: 0.001 },
  tabWidth: { low: 2, high: 4, step: 2 },
  defaultDirection: { values: ["ltr", "rtl"] },
  preferEarlySoftHyphenBreak: { values: [false, true] },
  preferPrefixWidthsForBreakableRuns: { values: [true] }
}
