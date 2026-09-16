import { Array as Arr, Layer } from "effect"

import { type Calibration, Hyphenation, MeasurementCache, Text, TextMeasurer } from "@scenesystems/effect-text"

export const calibrationServices = Layer.mergeAll(
  Text.layerSegmenter,
  Text.layerProfile,
  Hyphenation.layer(),
  MeasurementCache.layer.pipe(Layer.provide(TextMeasurer.layer))
)

export const defaultCalibrationProfile: Calibration.Profile = {
  name: "default-text-profile",
  profile: {
    lineFitEpsilon: 0.005,
    tabWidth: 4,
    defaultDirection: "ltr",
    preferEarlySoftHyphenBreak: false,
    preferPrefixWidthsForBreakableRuns: true
  }
}

export const canonicalTabAdvancesCase: Calibration.Case = {
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
    lines: Arr.make({ text: "a\tb", width: 19 })
  }
}

export const canonicalSoftHyphenWrapCase: Calibration.Case = {
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
    lines: Arr.make(
      { text: "alpha-", width: 34.8 },
      { text: "beta", width: 23.2 }
    )
  }
}

export const canonicalLongTokenGraphemeFallbackCase: Calibration.Case = {
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
    lines: Arr.make(
      { text: "http", width: 23.2 },
      { text: "s://", width: 23.2 },
      { text: "exam", width: 23.2 },
      { text: "ple.", width: 23.2 },
      { text: "com/", width: 23.2 },
      { text: "a-b?", width: 23.2 },
      { text: "x=1,", width: 23.8 },
      { text: "2", width: 6.4 }
    )
  }
}

export const canonicalCjkNoSpaceLayoutCase: Calibration.Case = {
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
    lines: Arr.make(
      { text: "你好", width: 11.6 },
      { text: "世界", width: 11.6 },
      { text: "你好", width: 11.6 }
    )
  }
}

export const canonicalMixedDirectionCase: Calibration.Case = {
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
    lines: Arr.make({ text: "hello (םולש)", width: 67.09999999999998 })
  }
}

export const canonicalDictionaryHyphenationCase: Calibration.Case = {
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
    lines: Arr.make(
      { text: "hy-", width: 17.4 },
      { text: "phen-", width: 29 },
      { text: "ation", width: 29 }
    )
  }
}

export const canonicalCalibrationCases: Calibration.Cases = Arr.make(
  canonicalTabAdvancesCase,
  canonicalSoftHyphenWrapCase,
  canonicalLongTokenGraphemeFallbackCase,
  canonicalCjkNoSpaceLayoutCase,
  canonicalMixedDirectionCase,
  canonicalDictionaryHyphenationCase
)

const LTR_DIRECTION: Text.Direction = "ltr"
const RTL_DIRECTION: Text.Direction = "rtl"

export const fixedSearch: Calibration.Search = {
  lineFitEpsilon: { low: 0.005, high: 0.005, step: 0.001 },
  tabWidth: { low: 4, high: 4, step: 1 },
  defaultDirection: { values: Arr.make(LTR_DIRECTION, RTL_DIRECTION) },
  preferEarlySoftHyphenBreak: { values: Arr.of(false) },
  preferPrefixWidthsForBreakableRuns: { values: Arr.of(true) }
}

export const exploratorySearch: Calibration.Search = {
  lineFitEpsilon: { low: 0.005, high: 0.005, step: 0.001 },
  tabWidth: { low: 2, high: 4, step: 2 },
  defaultDirection: { values: Arr.make(LTR_DIRECTION, RTL_DIRECTION) },
  preferEarlySoftHyphenBreak: { values: Arr.make(false, true) },
  preferPrefixWidthsForBreakableRuns: { values: Arr.of(true) }
}
