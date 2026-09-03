import { Layer } from "effect"

import { type Experimental, Text } from "@scenesystems/effect-text"

export const calibrationTextMeasurerLayer = Text.TextMeasurerLive

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
    name: "tab-advances",
    prepare: {
      text: "a\tb",
      font: { family: "system-ui", size: 10 },
      whiteSpace: "pre-wrap"
    },
    layout: { maxWidth: 100, lineHeight: 12 },
    expected: {
      lineCount: 1,
      maxLineWidth: 19,
      lines: [{ text: "a\tb", width: 19 }]
    }
  },
  {
    name: "soft-hyphen-wrap",
    prepare: {
      text: "alpha\u00adbeta",
      font: { family: "Mono", size: 10 },
      whiteSpace: "normal"
    },
    layout: { maxWidth: 35, lineHeight: 12 },
    expected: {
      lineCount: 2,
      maxLineWidth: 34.8,
      lines: [
        { text: "alpha-", width: 34.8 },
        { text: "beta", width: 23.2 }
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
      lineCount: 8,
      maxLineWidth: 23.8,
      lines: [
        { text: "http", width: 23.2 },
        { text: "s://", width: 23.2 },
        { text: "exam", width: 23.2 },
        { text: "ple.", width: 23.2 },
        { text: "com/", width: 23.2 },
        { text: "a-b?", width: 23.2 },
        { text: "x=1,", width: 23.8 },
        { text: "2", width: 6.4 }
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
      lineCount: 3,
      maxLineWidth: 11.6,
      lines: [
        { text: "你好", width: 11.6 },
        { text: "世界", width: 11.6 },
        { text: "你好", width: 11.6 }
      ]
    }
  },
  {
    name: "mixed-direction-case",
    prepare: {
      text: "(שלום) hello",
      font: { family: "system-ui", size: 10 },
      whiteSpace: "normal"
    },
    layout: { maxWidth: 200, lineHeight: 12 },
    expected: {
      lineCount: 1,
      maxLineWidth: 67.09999999999998,
      lines: [{ text: "hello (םולש)", width: 67.09999999999998 }]
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
      maxLineWidth: 29,
      lines: [
        { text: "hy-", width: 17.4 },
        { text: "phen-", width: 29 },
        { text: "ation", width: 29 }
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
