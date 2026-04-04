import { Layer } from "effect"
import * as Arr from "effect/Array"
import * as Option from "effect/Option"

import { Browser, Contracts, Text } from "../../src/index.js"
import type { PrepareInputType, WhiteSpaceModeType } from "../../src/Text/schema.js"

import type { BrowserAccuracyCaseIdType } from "./browserAccuracySchema.js"

type BrowserAccuracyCaseTemplate = Readonly<{
  caseId: BrowserAccuracyCaseIdType
  request: {
    readonly lineHeight: number
    readonly maxWidth: number
  }
  text: string
  whiteSpace: WhiteSpaceModeType
}>

export type BrowserAccuracyResolvedCase = Readonly<{
  caseId: BrowserAccuracyCaseIdType
  prepare: PrepareInputType
  request: {
    readonly lineHeight: number
    readonly maxWidth: number
  }
}>

type MeasurementOverride = readonly [text: string, width: number]

const baseFontSize = 10

const browserAccuracyCaseTemplates: ReadonlyArray<BrowserAccuracyCaseTemplate> = [
  {
    caseId: "white-space-normal",
    request: { lineHeight: 12, maxWidth: 100 },
    text: "alpha beta gamma",
    whiteSpace: "normal"
  },
  {
    caseId: "white-space-pre-wrap",
    request: { lineHeight: 12, maxWidth: 200 },
    text: "alpha  beta",
    whiteSpace: "pre-wrap"
  },
  {
    caseId: "trailing-whitespace-hard-breaks",
    request: { lineHeight: 12, maxWidth: 200 },
    text: "alpha  \nbeta",
    whiteSpace: "pre-wrap"
  },
  {
    caseId: "tab-advances",
    request: { lineHeight: 12, maxWidth: 100 },
    text: "a\tb",
    whiteSpace: "pre-wrap"
  },
  {
    caseId: "soft-hyphen",
    request: { lineHeight: 12, maxWidth: 60 },
    text: "alpha\u00adbeta",
    whiteSpace: "normal"
  },
  {
    caseId: "mixed-inline-punctuation",
    request: { lineHeight: 12, maxWidth: 200 },
    text: "(שלום) hello",
    whiteSpace: "normal"
  },
  {
    caseId: "fit-paint-divergence",
    request: { lineHeight: 12, maxWidth: 24 },
    text: "ffi",
    whiteSpace: "normal"
  }
]

const browserAccuracyMeasurementOverrides = (
  profileId: Browser.BrowserSupportProfileIdType
): ReadonlyArray<MeasurementOverride> =>
  profileId === "canvas-system-ui"
    ? [
      ["f", 10],
      ["i", 10],
      ["ff", 19],
      ["fi", 17],
      ["ffi", 25]
    ]
    : [
      ["f", 10],
      ["i", 10],
      ["ff", 18],
      ["fi", 16],
      ["ffi", 24]
    ]

const defaultMeasurementWidth = (text: string): number => Arr.fromIterable(text).length * baseFontSize

const measurementWidth = (profileId: Browser.BrowserSupportProfileIdType, text: string): number =>
  Arr.findFirst(browserAccuracyMeasurementOverrides(profileId), (entry) => entry[0] === text).pipe(
    Option.match({
      onNone: () => defaultMeasurementWidth(text),
      onSome: (entry) => entry[1]
    })
  )

class BrowserAccuracyCanvasContext {
  direction: "ltr" | "rtl" | "inherit" = "inherit"
  font = `${baseFontSize}px Mono`
  textBaseline: "top" | "hanging" | "middle" | "alphabetic" | "ideographic" | "bottom" = "alphabetic"

  constructor(readonly profileId: Browser.BrowserSupportProfileIdType) {}

  measureText(text: string): { readonly width: number } {
    return { width: measurementWidth(this.profileId, text) }
  }
}

export const browserAccuracyCaseIds = Arr.map(browserAccuracyCaseTemplates, (template) => template.caseId)

export const browserAccuracyCasesForProfile = (
  profile: Browser.BrowserSupportProfileType
): ReadonlyArray<BrowserAccuracyResolvedCase> =>
  Arr.map(browserAccuracyCaseTemplates, (template) => ({
    caseId: template.caseId,
    prepare: {
      text: template.text,
      font: { family: profile.defaultFontFamily, size: baseFontSize },
      whiteSpace: template.whiteSpace
    },
    request: template.request
  }))

export const browserAccuracyLayer = (profile: Browser.BrowserSupportProfileType) =>
  Layer.mergeAll(
    Text.WordSegmenterLive,
    Layer.succeed(Contracts.EngineProfile, profile.engineProfile),
    Browser.BrowserMeasurementCacheLive({
      fontReadinessRevision: Browser.initialFontReadinessRevision(),
      profileId: profile.id
    }).pipe(
      Layer.provide(
        Browser.CanvasTextMeasurerLive({
          context: new BrowserAccuracyCanvasContext(profile.id)
        })
      )
    )
  )

export const browserAccuracyArtifactRelativePath = (profileId: Browser.BrowserSupportProfileIdType): string =>
  `examples/live/artifacts/${profileId}.json`
